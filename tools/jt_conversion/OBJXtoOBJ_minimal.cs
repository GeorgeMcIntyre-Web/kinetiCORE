/**
 * OBJX to OBJ - Minimal version that just extracts what we can
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

        try
        {
            var workspace = new SimpleWorkspace();
            var objx = ObjX.Load(workspace, args[0]);

            Console.WriteLine("Loaded OBJX:");
            Console.WriteLine("  Models: " + objx.Models.Count);
            Console.WriteLine("  Materials: " + objx.Materials.Count);

            // Just write empty OBJ with materials for now
            using (var obj = new StreamWriter(args[1]))
            using (var mtl = new StreamWriter(Path.ChangeExtension(args[1], ".mtl")))
            {
                obj.WriteLine("# OBJX converted - geometry extraction in progress");
                obj.WriteLine("mtllib " + Path.GetFileName(Path.ChangeExtension(args[1], ".mtl")));

                mtl.WriteLine("# Materials from OBJX");
                for (int i = 0; i < objx.Materials.Count; i++)
                {
                    var mat = objx.Materials[i];
                    mtl.WriteLine("newmtl mat_" + i);
                    mtl.WriteLine("Kd " + mat.Diffuse.X + " " + mat.Diffuse.Y + " " + mat.Diffuse.Z);
                }
            }

            Console.WriteLine("SUCCESS - Files created (geometry extraction pending)");
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
            return 1;
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
