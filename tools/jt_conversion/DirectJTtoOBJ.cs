/**
 * Direct JT to OBJ Converter - Extracts geometry directly from JT files
 * Outputs standard OBJ/MTL text files (not OBJX binary format)
 *
 * Uses JT Open Toolkit to read geometry and writes standard Wavefront OBJ format
 */

using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using JtReader;

class DirectJTtoOBJ
{
    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("Usage: DirectJTtoOBJ.exe <input.jt> <output.obj>");
            return 1;
        }

        string jtPath = args[0];
        string objPath = args[1];

        if (!File.Exists(jtPath))
        {
            Console.Error.WriteLine("ERROR: JT file not found: " + jtPath);
            return 1;
        }

        try
        {
            Console.WriteLine("JT → OBJ Direct Converter");
            Console.WriteLine("Input:  " + jtPath);
            Console.WriteLine("Output: " + objPath);
            Console.WriteLine();

            // Open JT file
            Console.WriteLine("[1/3] Opening JT file with JT Open Toolkit...");
            Opener opener = new Opener();
            int result = opener.Open(jtPath, true);  // true = load geometry

            if (result != 1)
            {
                Console.Error.WriteLine("ERROR: Failed to open JT file. Code: " + result);
                return 1;
            }

            var root = opener.Root;
            if (root == null)
            {
                Console.Error.WriteLine("ERROR: No geometry in JT file");
                return 1;
            }

            Console.WriteLine("  Loaded: " + root.Name);

            // Extract geometry
            Console.WriteLine("[2/3] Extracting geometry...");
            var objData = new OBJData();
            int partCount = ExtractGeometry(root, objData, 0);

            Console.WriteLine("  Found " + partCount + " parts");
            Console.WriteLine("  Vertices: " + objData.Vertices.Count);
            Console.WriteLine("  Faces: " + objData.Faces.Count);

            // Write OBJ file
            Console.WriteLine("[3/3] Writing OBJ file...");
            string mtlPath = Path.ChangeExtension(objPath, ".mtl");
            string mtlFile = Path.GetFileName(mtlPath);

            WriteOBJ(objPath, mtlFile, objData);
            WriteMTL(mtlPath, objData);

            // Cleanup
            opener.Dispose();
            Opener.Deinitialize();

            Console.WriteLine();
            Console.WriteLine("SUCCESS!");
            Console.WriteLine("  " + objPath);
            Console.WriteLine("  " + mtlPath);

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine("ERROR: " + ex.Message);
            Console.Error.WriteLine(ex.StackTrace);
            return 1;
        }
    }

    static int ExtractGeometry(Hierarchy node, OBJData objData, int depth)
    {
        int partCount = 0;

        // Process based on type
        if (node is Part)
        {
            Part part = (Part)node;
            partCount++;

            // Extract mesh data from part
            if (part.Lods != null && part.Lods.Length > 0)
            {
                // Use highest LOD (index 0)
                Lod lod = part.Lods[0];

                if (lod.VertexShapeData != null && lod.VertexShapeData.Shapes != null)
                {
                    foreach (var shape in lod.VertexShapeData.Shapes)
                    {
                        ProcessShape(shape, objData, part.Name ?? "part");
                    }
                }
            }
        }
        else if (node is Assembly)
        {
            Assembly assembly = (Assembly)node;

            // Recursively process children
            if (assembly.Children != null)
            {
                foreach (var child in assembly.Children)
                {
                    partCount += ExtractGeometry(child, objData, depth + 1);
                }
            }
        }

        return partCount;
    }

    static void ProcessShape(VertexBasedShape shape, OBJData objData, string partName)
    {
        if (shape == null) return;

        // Get material
        string materialName = "default";
        if (shape.HasMaterial)
        {
            materialName = "mat_" + objData.Materials.Count;

            if (!objData.Materials.ContainsKey(materialName))
            {
                var material = new MTLMaterial
                {
                    Name = materialName,
                    DiffuseColor = new float[] {
                        shape.Material.DiffuseColor.R,
                        shape.Material.DiffuseColor.G,
                        shape.Material.DiffuseColor.B
                    },
                    AmbientColor = new float[] {
                        shape.Material.AmbientColor.R,
                        shape.Material.AmbientColor.G,
                        shape.Material.AmbientColor.B
                    },
                    SpecularColor = new float[] {
                        shape.Material.SpecularColor.R,
                        shape.Material.SpecularColor.G,
                        shape.Material.SpecularColor.B
                    }
                };
                objData.Materials[materialName] = material;
            }
        }

        // Get vertices
        if (shape.Positions == null || shape.Positions.Length == 0)
            return;

        int vertexOffset = objData.Vertices.Count;

        // Add vertices
        for (int i = 0; i < shape.Positions.Length; i++)
        {
            var pos = shape.Positions[i];
            objData.Vertices.Add(new float[] { pos.X, pos.Y, pos.Z });
        }

        // Add normals
        bool hasNormals = shape.Normals != null && shape.Normals.Length > 0;
        if (hasNormals)
        {
            for (int i = 0; i < shape.Normals.Length; i++)
            {
                var normal = shape.Normals[i];
                objData.Normals.Add(new float[] { normal.X, normal.Y, normal.Z });
            }
        }

        // Add faces (triangles)
        if (shape is TriStripSet)
        {
            TriStripSet triStrip = (TriStripSet)shape;
            ProcessTriStripSet(triStrip, objData, vertexOffset, materialName);
        }
        else if (shape is PolylineSet)
        {
            // Skip polylines (not solid geometry)
        }
        else
        {
            // Try to extract faces from generic shape
            Console.WriteLine("  Warning: Unknown shape type: " + shape.GetType().Name);
        }
    }

    static void ProcessTriStripSet(TriStripSet triStrip, OBJData objData, int vertexOffset, string materialName)
    {
        if (triStrip.Indices == null || triStrip.Indices.Length == 0)
            return;

        // Convert triangle strips to individual triangles
        for (int i = 0; i < triStrip.Indices.Length - 2; i++)
        {
            int i0 = triStrip.Indices[i] + vertexOffset + 1;  // OBJ is 1-indexed
            int i1 = triStrip.Indices[i + 1] + vertexOffset + 1;
            int i2 = triStrip.Indices[i + 2] + vertexOffset + 1;

            // Triangle strips alternate winding order
            if (i % 2 == 0)
            {
                objData.Faces.Add(new Face {
                    Material = materialName,
                    Indices = new int[] { i0, i1, i2 }
                });
            }
            else
            {
                objData.Faces.Add(new Face {
                    Material = materialName,
                    Indices = new int[] { i0, i2, i1 }  // Reversed for odd triangles
                });
            }
        }
    }

    static void WriteOBJ(string path, string mtlFile, OBJData data)
    {
        using (StreamWriter writer = new StreamWriter(path))
        {
            writer.WriteLine("# Generated by DirectJTtoOBJ");
            writer.WriteLine("# Vertices: " + data.Vertices.Count);
            writer.WriteLine("# Faces: " + data.Faces.Count);
            writer.WriteLine();
            writer.WriteLine("mtllib " + mtlFile);
            writer.WriteLine();

            // Write vertices
            foreach (var v in data.Vertices)
            {
                writer.WriteLine(string.Format("v {0:F6} {1:F6} {2:F6}", v[0], v[1], v[2]));
            }

            writer.WriteLine();

            // Write normals
            foreach (var n in data.Normals)
            {
                writer.WriteLine(string.Format("vn {0:F6} {1:F6} {2:F6}", n[0], n[1], n[2]));
            }

            writer.WriteLine();

            // Write faces grouped by material
            string currentMaterial = null;
            foreach (var face in data.Faces)
            {
                if (face.Material != currentMaterial)
                {
                    writer.WriteLine();
                    writer.WriteLine("usemtl " + face.Material);
                    currentMaterial = face.Material;
                }

                writer.Write("f");
                foreach (int idx in face.Indices)
                {
                    writer.Write(" " + idx);
                }
                writer.WriteLine();
            }
        }
    }

    static void WriteMTL(string path, OBJData data)
    {
        using (StreamWriter writer = new StreamWriter(path))
        {
            writer.WriteLine("# Generated by DirectJTtoOBJ");
            writer.WriteLine();

            foreach (var kvp in data.Materials)
            {
                var mat = kvp.Value;
                writer.WriteLine("newmtl " + mat.Name);
                writer.WriteLine(string.Format("Ka {0:F6} {1:F6} {2:F6}",
                    mat.AmbientColor[0], mat.AmbientColor[1], mat.AmbientColor[2]));
                writer.WriteLine(string.Format("Kd {0:F6} {1:F6} {2:F6}",
                    mat.DiffuseColor[0], mat.DiffuseColor[1], mat.DiffuseColor[2]));
                writer.WriteLine(string.Format("Ks {0:F6} {1:F6} {2:F6}",
                    mat.SpecularColor[0], mat.SpecularColor[1], mat.SpecularColor[2]));
                writer.WriteLine("Ns 32.0");
                writer.WriteLine("d 1.0");
                writer.WriteLine("illum 2");
                writer.WriteLine();
            }
        }
    }
}

// Data structures
class OBJData
{
    public List<float[]> Vertices = new List<float[]>();
    public List<float[]> Normals = new List<float[]>();
    public List<Face> Faces = new List<Face>();
    public Dictionary<string, MTLMaterial> Materials = new Dictionary<string, MTLMaterial>();
}

class Face
{
    public string Material;
    public int[] Indices;
}

class MTLMaterial
{
    public string Name;
    public float[] DiffuseColor;
    public float[] AmbientColor;
    public float[] SpecularColor;
}
