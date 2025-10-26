/**
 * OBJX to OBJ Converter v2
 * Converts LineSimulator OBJX files to standard Wavefront OBJ/MTL
 * Based on discovered ObjXFile.dll API structure
 */

using System;
using System.IO;
using ObjXFile;
using LineSimulatorLibrary.Models;

class OBJXtoOBJ_v2
{
    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("Usage: OBJXtoOBJ.exe <input.objx> <output.obj>");
            return 1;
        }

        string objxPath = args[0];
        string objPath = args[1];

        if (!File.Exists(objxPath))
        {
            Console.Error.WriteLine("ERROR: File not found: " + objxPath);
            return 1;
        }

        try
        {
            Console.WriteLine("OBJX → OBJ Converter");
            Console.WriteLine("Input:  " + objxPath);
            Console.WriteLine("Output: " + objPath);
            Console.WriteLine();

            // Load OBJX using workspace
            Console.WriteLine("[1/2] Loading OBJX file...");
            var workspace = new SimpleWorkspace();
            var objx = ObjX.Load(workspace, objxPath);

            if (objx == null)
            {
                Console.Error.WriteLine("ERROR: Failed to load OBJX");
                return 1;
            }

            Console.WriteLine("  Name: " + (objx.Name ?? "unnamed"));
            Console.WriteLine("  Version: " + objx.Version);
            Console.WriteLine("  Models: " + (objx.Models != null ? objx.Models.Count.ToString() : "0"));
            Console.WriteLine("  Materials: " + (objx.Materials != null ? objx.Materials.Count.ToString() : "0"));

            // Export to OBJ/MTL
            Console.WriteLine("[2/2] Writing OBJ/MTL files...");
            string mtlPath = Path.ChangeExtension(objPath, ".mtl");
            string mtlFile = Path.GetFileName(mtlPath);

            WriteOBJ(objPath, mtlFile, objx);
            WriteMTL(mtlPath, objx);

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

    static void WriteOBJ(string path, string mtlFile, ObjX objx)
    {
        using (StreamWriter writer = new StreamWriter(path))
        {
            writer.WriteLine("# Converted from OBJX to OBJ");
            writer.WriteLine("mtllib " + mtlFile);
            writer.WriteLine();

            if (objx.Models == null || objx.Models.Count == 0)
            {
                Console.WriteLine("  Warning: No models found");
                return;
            }

            int totalVertices = 0;

            // Process each model
            for (int m = 0; m < objx.Models.Count; m++)
            {
                var model = objx.Models[m];

                writer.WriteLine("# Model: " + (model.Name ?? ("model_" + model.Id)));
                writer.WriteLine("o " + (model.Name ?? ("model_" + model.Id)));

                if (model.Lods == null || model.Lods.Count == 0)
                {
                    Console.WriteLine("  Warning: Model has no LODs: " + model.Name);
                    continue;
                }

                // Use highest LOD (first one)
                var lod = model.Lods[0];

                if (lod.VertexDataList == null)
                {
                    Console.WriteLine("  Warning: LOD has no vertex data: " + model.Name);
                    continue;
                }

                // Write vertices
                int vertexCount = lod.VertexDataList.Count;
                for (int i = 0; i < vertexCount; i++)
                {
                    var vertex = lod.VertexDataList[i];
                    writer.WriteLine(string.Format("v {0:F6} {1:F6} {2:F6}",
                        vertex.Position.X, vertex.Position.Y, vertex.Position.Z));
                }

                // Write normals
                for (int i = 0; i < vertexCount; i++)
                {
                    var vertex = lod.VertexDataList[i];
                    if (vertex.Normal != null)
                    {
                        writer.WriteLine(string.Format("vn {0:F6} {1:F6} {2:F6}",
                            vertex.Normal.X, vertex.Normal.Y, vertex.Normal.Z));
                    }
                }

                writer.WriteLine();

                // Write faces from shapes
                if (lod.Shapes != null && lod.Shapes.Count > 0)
                {
                    int currentMaterial = -1;

                    for (int s = 0; s < lod.Shapes.Count; s++)
                    {
                        var shape = lod.Shapes[s];

                        // Set material
                        if (shape.Material != currentMaterial)
                        {
                            currentMaterial = shape.Material;
                            writer.WriteLine("usemtl mat_" + currentMaterial);
                        }

                        // Check if it's a TriStripSet or LineStripSet
                        if (shape is ObjXFile.TriStripSet)
                        {
                            var triStrip = (ObjXFile.TriStripSet)shape;
                            if (triStrip.Indicies != null && triStrip.Indicies.Count >= 3)
                            {
                                // Convert triangle strip to individual triangles
                                for (int i = 0; i < triStrip.Indicies.Count - 2; i++)
                                {
                                    int i0 = triStrip.Indicies[i] + totalVertices + 1;
                                    int i1 = triStrip.Indicies[i + 1] + totalVertices + 1;
                                    int i2 = triStrip.Indicies[i + 2] + totalVertices + 1;

                                    // Triangle strips alternate winding
                                    if (i % 2 == 0)
                                        writer.WriteLine("f " + i0 + " " + i1 + " " + i2);
                                    else
                                        writer.WriteLine("f " + i0 + " " + i2 + " " + i1);
                                }
                            }
                        }
                    }
                }

                totalVertices += vertexCount;
                writer.WriteLine();
            }

            Console.WriteLine("  Wrote " + totalVertices + " vertices");
        }
    }

    static void WriteMTL(string path, ObjX objx)
    {
        using (StreamWriter writer = new StreamWriter(path))
        {
            writer.WriteLine("# Converted from OBJX to MTL");
            writer.WriteLine();

            if (objx.Materials == null || objx.Materials.Count == 0)
            {
                Console.WriteLine("  Warning: No materials found");
                return;
            }

            for (int i = 0; i < objx.Materials.Count; i++)
            {
                var mat = objx.Materials[i];

                writer.WriteLine("newmtl mat_" + i);
                writer.WriteLine(string.Format("Ka {0:F6} {1:F6} {2:F6}",
                    mat.Ambient.X, mat.Ambient.Y, mat.Ambient.Z));
                writer.WriteLine(string.Format("Kd {0:F6} {1:F6} {2:F6}",
                    mat.Diffuse.X, mat.Diffuse.Y, mat.Diffuse.Z));
                writer.WriteLine(string.Format("Ks {0:F6} {1:F6} {2:F6}",
                    mat.Specular.X, mat.Specular.Y, mat.Specular.Z));
                writer.WriteLine(string.Format("Ns {0:F6}", mat.SpecularExp));
                writer.WriteLine(string.Format("d {0:F6}", mat.Dissolve));
                writer.WriteLine("illum 2");
                writer.WriteLine();
            }

            Console.WriteLine("  Wrote " + objx.Materials.Count + " materials");
        }
    }
}

// Simple workspace implementation for ObjX.Load
class SimpleWorkspace : IWorkspace
{
    public string FileDirectory { get { return "."; } }
    public string FileName { get { return ""; } }
    public string FullFileName { get { return ""; } }

    public bool CreateDirectory(string path)
    {
        if (!Directory.Exists(path))
            Directory.CreateDirectory(path);
        return true;
    }

    public bool DeleteFile(string path)
    {
        if (File.Exists(path))
        {
            File.Delete(path);
            return true;
        }
        return false;
    }

    public bool DeleteDirectory(string path, bool recursive)
    {
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive);
            return true;
        }
        return false;
    }

    public bool FileExists(string path)
    {
        return File.Exists(path);
    }

    public long FileSize(string path)
    {
        return new FileInfo(path).Length;
    }

    public bool DirectoryExists(string path)
    {
        return Directory.Exists(path);
    }

    public System.Collections.Generic.IEnumerable<string> GetFiles(string path)
    {
        return Directory.GetFiles(path);
    }

    public System.Collections.Generic.IEnumerable<string> GetDirectories(string path)
    {
        return Directory.GetDirectories(path);
    }

    public Stream SaveTo(string path)
    {
        return File.Create(path);
    }

    public Stream SaveTo(string path, FileMode mode, FileAccess access, FileShare share)
    {
        return File.Open(path, mode, access, share);
    }

    public byte[] ReadAllBytes(string path)
    {
        return File.ReadAllBytes(path);
    }

    public Stream LoadFrom(string path)
    {
        return File.OpenRead(path);
    }

    public Stream LoadFrom(string path, FileMode mode, FileAccess access, FileShare share)
    {
        return File.Open(path, mode, access, share);
    }
}
