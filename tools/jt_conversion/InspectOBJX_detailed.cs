/**
 * Detailed OBJX Inspector - Shows exact structure of loaded OBJX data
 */
using System;
using System.IO;
using System.Reflection;
using ObjXFile;
using LineSimulatorLibrary.Models;

class InspectOBJX
{
    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: InspectOBJX.exe <input.objx>");
            return;
        }

        try
        {
            var workspace = new SimpleWorkspace();
            var objx = ObjX.Load(workspace, args[0]);

            Console.WriteLine("=== OBJX Structure ===");
            Console.WriteLine("Models: " + objx.Models.Count);
            Console.WriteLine("Materials: " + objx.Materials.Count);
            Console.WriteLine();

            // Examine first model
            if (objx.Models.Count > 0)
            {
                // Use enumerator to get first model
                var modelEnum = ((System.Collections.IEnumerable)objx.Models).GetEnumerator();
                if (modelEnum.MoveNext())
                {
                    dynamic model = modelEnum.Current;

                    Console.WriteLine("=== First Model ===");
                    Console.WriteLine("Type: " + model.GetType().FullName);
                    Console.WriteLine("Name: " + model.Name);
                    Console.WriteLine("Id: " + model.Id);
                    Console.WriteLine("Lods.Count: " + (model.Lods != null ? model.Lods.Count.ToString() : "null"));
                    Console.WriteLine();

                    if (model.Lods != null && model.Lods.Count > 0)
                    {
                        // Get first LOD
                        var lodEnum = ((System.Collections.IEnumerable)model.Lods).GetEnumerator();
                        if (lodEnum.MoveNext())
                        {
                            dynamic lod = lodEnum.Current;

                            Console.WriteLine("=== First LOD ===");
                            Console.WriteLine("Type: " + lod.GetType().FullName);

                            Type lodType = lod.GetType();
                            Console.WriteLine("\nLOD Properties:");
                            foreach (var prop in lodType.GetProperties(BindingFlags.Public | BindingFlags.Instance))
                            {
                                try
                                {
                                    var value = prop.GetValue(lod, null);
                                    Console.WriteLine("  " + prop.Name + ": " + prop.PropertyType.Name + " = " + (value != null ? value.ToString() : "null"));
                                }
                                catch
                                {
                                    Console.WriteLine("  " + prop.Name + ": " + prop.PropertyType.Name + " (error reading)");
                                }
                            }

                            // Deep dive into VertexDataList
                            if (lod.VertexDataList != null)
                            {
                                Console.WriteLine("\n=== VertexDataList ===");
                                var vdl = lod.VertexDataList;
                                Type vdlType = vdl.GetType();
                                Console.WriteLine("Type: " + vdlType.FullName);
                                Console.WriteLine("Base Type: " + (vdlType.BaseType != null ? vdlType.BaseType.FullName : "none"));

                                Console.WriteLine("\nProperties:");
                                foreach (var prop in vdlType.GetProperties(BindingFlags.Public | BindingFlags.Instance))
                                {
                                    Console.WriteLine("  " + prop.PropertyType.Name + " " + prop.Name);

                                    // Try to get value
                                    try
                                    {
                                        if (prop.Name == "Count")
                                        {
                                            var count = prop.GetValue(vdl, null);
                                            Console.WriteLine("    Value: " + count);
                                        }
                                        else if (prop.Name == "Item")
                                        {
                                            Console.WriteLine("    (Indexer property)");
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        Console.WriteLine("    Error: " + ex.Message);
                                    }
                                }

                                Console.WriteLine("\nMethods:");
                                foreach (var method in vdlType.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                                {
                                    if (!method.IsSpecialName) // Skip property getters/setters
                                    {
                                        var parameters = method.GetParameters();
                                        Console.WriteLine("  " + method.ReturnType.Name + " " + method.Name + "(" +
                                            string.Join(", ", Array.ConvertAll(parameters, p => p.ParameterType.Name + " " + p.Name)) + ")");
                                    }
                                }

                                // Try to access first vertex using different methods
                                Console.WriteLine("\n=== Attempting to access first vertex ===");

                                // Method 1: Try GetEnumerator
                                try
                                {
                                    var vdlEnum = ((System.Collections.IEnumerable)vdl).GetEnumerator();
                                    if (vdlEnum.MoveNext())
                                    {
                                        dynamic vertex = vdlEnum.Current;
                                        Console.WriteLine("SUCCESS via Enumerator!");
                                        Console.WriteLine("  Vertex type: " + vertex.GetType().FullName);
                                        Console.WriteLine("  Position: " + vertex.Position);
                                        Console.WriteLine("  Normal: " + (vertex.Normal != null ? vertex.Normal.ToString() : "null"));
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine("Method 1 (Enumerator) failed: " + ex.Message);
                                }

                                // Method 2: Try ToList if available
                                try
                                {
                                    var toListMethod = vdlType.GetMethod("ToList");
                                    if (toListMethod != null)
                                    {
                                        dynamic list = toListMethod.Invoke(vdl, null);
                                        Console.WriteLine("SUCCESS via ToList!");
                                        Console.WriteLine("  List count: " + list.Count);
                                        if (list.Count > 0)
                                        {
                                            dynamic vertex = list[0];
                                            Console.WriteLine("  First vertex position: " + vertex.Position);
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine("Method 2 (ToList) failed: " + ex.Message);
                                }
                            }

                            // Check Shapes
                            if (lod.Shapes != null)
                            {
                                Console.WriteLine("\n=== Shapes ===");
                                var shapes = lod.Shapes;
                                Type shapesType = shapes.GetType();
                                Console.WriteLine("Type: " + shapesType.FullName);
                                Console.WriteLine("Count: " + shapes.Count);

                                if (shapes.Count > 0)
                                {
                                    var shapeEnum = ((System.Collections.IEnumerable)shapes).GetEnumerator();
                                    if (shapeEnum.MoveNext())
                                    {
                                        dynamic shape = shapeEnum.Current;
                                        Console.WriteLine("\nFirst Shape:");
                                        Console.WriteLine("  Type: " + shape.GetType().FullName);
                                        Console.WriteLine("  Material: " + shape.Material);

                                        // Check for Indicies property
                                        Type shapeType = shape.GetType();
                                        var indiciesProp = shapeType.GetProperty("Indicies");
                                        if (indiciesProp != null)
                                        {
                                            var indicies = indiciesProp.GetValue(shape, null);
                                            if (indicies != null)
                                            {
                                                Console.WriteLine("  Indicies.Count: " + indicies.Count);
                                                Console.WriteLine("  Indicies type: " + indicies.GetType().FullName);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
            Console.WriteLine(ex.StackTrace);
        }
    }
}

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
