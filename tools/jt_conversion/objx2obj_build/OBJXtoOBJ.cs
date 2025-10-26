/**
 * OBJX to OBJ Converter - Working Version
 * Uses .Items property for direct array access
 */

using System;
using System.IO;
using ObjXFile;
using LineSimulatorLibrary.Models;

class OBJXtoOBJ
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

        try
        {
            Console.WriteLine("OBJX → OBJ Converter");
            Console.WriteLine("Input:  " + objxPath);
            Console.WriteLine("Output: " + objPath);
            Console.WriteLine();

            // Load OBJX
            Console.WriteLine("[1/2] Loading OBJX...");
            var workspace = new SimpleWorkspace();
            var objx = ObjX.Load(workspace, objxPath);

            Console.WriteLine("  Version: " + objx.Version);
            Console.WriteLine("  Models: " + objx.Models.Count);
            Console.WriteLine("  Materials: " + objx.Materials.Count);

            // Export
            Console.WriteLine("[2/2] Writing OBJ/MTL...");
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

            int totalVertices = 0;

            Console.WriteLine("  Processing " + objx.Models.Count + " models...");

            // Iterate models using indexer
            for (int m = 0; m < objx.Models.Count; m++)
            {
                var model = objx.Models[m];
                if (model == null)
                {
                    Console.WriteLine("  Warning: Null model at index " + m);
                    continue;
                }

                writer.WriteLine("# Model: " + (model.Name ?? ("model_" + model.Id)));
                writer.WriteLine("o " + (model.Name ?? ("model_" + model.Id)));

                if (model.Lods == null || model.Lods.Count == 0)
                {
                    Console.WriteLine("  Warning: Model " + model.Name + " has no LODs");
                    continue;
                }

                // Use first LOD (highest detail)
                var lod = model.Lods[0];

                // Access vertices via .Items array property
                var vertices = lod.VertexDataList.Items;
                if (vertices == null || vertices.Length == 0)
                {
                    Console.WriteLine("  Warning: No vertex data for model " + model.Name);
                    continue;
                }

                // Write vertices
                for (int i = 0; i < vertices.Length; i++)
                {
                    var vertex = vertices[i];
                    writer.WriteLine(string.Format("v {0:F6} {1:F6} {2:F6}",
                        vertex.Position.X, vertex.Position.Y, vertex.Position.Z));
                }

                // Write normals if available
                for (int i = 0; i < vertices.Length; i++)
                {
                    var vertex = vertices[i];
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
                        int mat = shape.Material;
                        if (mat != currentMaterial)
                        {
                            currentMaterial = mat;
                            writer.WriteLine("usemtl mat_" + currentMaterial);
                        }

                        // Shape has TriangleFaceSet property
                        if (shape.TriangleFaceSet != null && shape.TriangleFaceSet.Indicies != null && shape.TriangleFaceSet.Indicies.Length >= 3)
                        {
                            var indices = shape.TriangleFaceSet.Indicies;

                            // Triangle strip conversion
                            for (int i = 0; i < indices.Length - 2; i++)
                            {
                                int i0 = indices[i] + totalVertices + 1;
                                int i1 = indices[i + 1] + totalVertices + 1;
                                int i2 = indices[i + 2] + totalVertices + 1;

                                // Alternate winding for triangle strips
                                if (i % 2 == 0)
                                    writer.WriteLine("f " + i0 + " " + i1 + " " + i2);
                                else
                                    writer.WriteLine("f " + i0 + " " + i2 + " " + i1);
                            }
                        }
                    }
                }

                totalVertices += vertices.Length;
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

// Simple workspace for ObjX.Load
class SimpleWorkspace : IWorkspace
{
    public string FileDirectory { get { return "."; } }
    public string FileName { get { return ""; } }
    public string FullFileName { get { return ""; } }
    public bool CreateDirectory(string path) { if (!Directory.Exists(path)) Directory.CreateDirectory(path); return true; }
    public bool DeleteFile(string path) { if (File.Exists(path)) { File.Delete(path); return true; } return false; }
    public bool DeleteDirectory(string path, bool recursive) { if (Directory.Exists(path)) { Directory.Delete(path, recursive); return true; } return false; }
    public bool FileExists(string path) { return File.Exists(path); }
    public long FileSize(string path) { return new FileInfo(path).Length; }
    public bool DirectoryExists(string path) { return Directory.Exists(path); }
    public System.Collections.Generic.IEnumerable<string> GetFiles(string path) { return Directory.GetFiles(path); }
    public System.Collections.Generic.IEnumerable<string> GetDirectories(string path) { return Directory.GetDirectories(path); }
    public Stream SaveTo(string path) { return File.Create(path); }
    public Stream SaveTo(string path, FileMode mode, FileAccess access, FileShare share) { return File.Open(path, mode, access, share); }
    public byte[] ReadAllBytes(string path) { return File.ReadAllBytes(path); }
    public Stream LoadFrom(string path) { return File.OpenRead(path); }
    public Stream LoadFrom(string path, FileMode mode, FileAccess access, FileShare share) { return File.Open(path, mode, access, share); }
}
