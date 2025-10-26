/**
 * Minimal JT to OBJ Converter using LineSimulator DLLs
 * No custom dependencies - just calls LineSimulator libraries directly
 */

using System;
using System.IO;
using JtReader;
using ObjXWriter;
using LineSimulatorLibrary.Models;
using ModelDataFile;

class SimpleJTtoOBJ
{
    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("Usage: SimpleJTtoOBJ.exe <input.jt> <output.obj>");
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
            Console.WriteLine("Converting: " + jtPath);
            Console.WriteLine("Output: " + objPath);
            Console.WriteLine();

            // Initialize JT Open Toolkit
            Opener opener = new Opener();

            // Open JT file
            Console.WriteLine("[1/3] Opening JT file...");
            int result = opener.Open(jtPath, true);  // true = load geometry

            if (result != 1)
            {
                Console.Error.WriteLine("ERROR: Failed to open JT file. Code: " + result);
                return 1;
            }

            var root = opener.Root;
            if (root == null)
            {
                Console.Error.WriteLine("ERROR: No geometry found in JT file");
                return 1;
            }

            Console.WriteLine("  Loaded: " + root.Name);

            // Create output directory
            string outputDir = Path.GetDirectoryName(objPath);
            if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
            {
                Directory.CreateDirectory(outputDir);
            }

            // Convert to OBJ
            Console.WriteLine("[2/3] Converting geometry...");
            string outputFile = Path.GetFileNameWithoutExtension(objPath);

            var objxOutput = new ObjXOutput(
                new SimpleWorkspace(),
                outputDir ?? ".",
                outputFile,
                lod: 0  // Highest detail
            );

            objxOutput.ConvertFromJt(root, new System.Collections.Generic.Dictionary<int, System.Tuple<int, int>>());

            // Export OBJ and MTL files
            Console.WriteLine("[3/3] Writing OBJ and MTL files...");

            // Create empty ModelData to avoid null reference
            var modelData = new ModelData();

            // Export to OBJ/MTL format
            objxOutput.Export(modelData);

            // Cleanup
            opener.Dispose();
            Opener.Deinitialize();

            Console.WriteLine();
            Console.WriteLine("SUCCESS! Created:");
            Console.WriteLine("  " + objPath);
            Console.WriteLine("  " + Path.ChangeExtension(objPath, ".mtl"));

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("ERROR: " + ex.Message);
            Console.Error.WriteLine(ex.StackTrace);
            return 1;
        }
    }
}

// Minimal workspace implementation implementing all IWorkspace methods
class SimpleWorkspace : IWorkspace
{
    public string FileDirectory { get { return "."; } }
    public string FileName { get { return ""; } }
    public string FullFileName { get { return ""; } }

    public bool CreateDirectory(string path)
    {
        if (!Directory.Exists(path))
        {
            Directory.CreateDirectory(path);
        }
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
