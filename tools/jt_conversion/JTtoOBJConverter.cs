/**
 * JT to OBJ Converter using LineSimulator DLLs
 *
 * This C# console app uses the existing Tecnomatix LineSimulator DLLs
 * to convert JT files to OBJ format for web viewing.
 *
 * Usage:
 *   JTtoOBJConverter.exe input.jt output.obj
 *   JTtoOBJConverter.exe --batch C:\RobotLibrary C:\OutputOBJs
 *
 * Compile with:
 *   csc /reference:"C:\tmp\LineSimulator\lib3\JtReader.dll" JTtoOBJConverter.cs
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using JtReader;

namespace JTtoOBJConverter
{
    class Program
    {
        static int Main(string[] args)
        {
            Console.WriteLine("JT to OBJ Converter v1.0");
            Console.WriteLine("Using LineSimulator DLLs\n");

            if (args.Length < 2)
            {
                ShowUsage();
                return 1;
            }

            try
            {
                // Set DLL search path to find dependencies
                string lineSimPath = @"C:\tmp\LineSimulator";
                SetDllDirectory(Path.Combine(lineSimPath, "lib3"));

                if (args[0] == "--batch")
                {
                    return BatchConvert(args[1], args[2]);
                }
                else
                {
                    return ConvertSingle(args[0], args[1]);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"ERROR: {ex.Message}");
                Console.Error.WriteLine(ex.StackTrace);
                return 1;
            }
        }

        static void ShowUsage()
        {
            Console.WriteLine("Usage:");
            Console.WriteLine("  Single file:");
            Console.WriteLine("    JTtoOBJConverter.exe <input.jt> <output.obj>");
            Console.WriteLine();
            Console.WriteLine("  Batch convert:");
            Console.WriteLine("    JTtoOBJConverter.exe --batch <input_dir> <output_dir>");
            Console.WriteLine();
            Console.WriteLine("Examples:");
            Console.WriteLine("  JTtoOBJConverter.exe kr270r2700.jt kr270r2700.obj");
            Console.WriteLine("  JTtoOBJConverter.exe --batch C:\\Robots\\KUKA C:\\Output\\KUKA");
        }

        static int ConvertSingle(string inputPath, string outputPath)
        {
            if (!File.Exists(inputPath))
            {
                Console.Error.WriteLine($"Input file not found: {inputPath}");
                return 1;
            }

            Console.WriteLine($"Converting: {Path.GetFileName(inputPath)}");
            Console.WriteLine($"Input:  {inputPath}");
            Console.WriteLine($"Output: {outputPath}");

            try
            {
                // Create output directory if needed
                string outputDir = Path.GetDirectoryName(outputPath);
                if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }

                // Convert JT → OBJ
                JTConverter converter = new JTConverter();
                converter.Convert(inputPath, outputPath);

                Console.WriteLine("✓ Conversion successful!");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"✗ Conversion failed: {ex.Message}");
                return 1;
            }
        }

        static int BatchConvert(string inputDir, string outputDir)
        {
            if (!Directory.Exists(inputDir))
            {
                Console.Error.WriteLine($"Input directory not found: {inputDir}");
                return 1;
            }

            if (!Directory.Exists(outputDir))
            {
                Directory.CreateDirectory(outputDir);
            }

            Console.WriteLine($"Batch converting JT files...");
            Console.WriteLine($"Input:  {inputDir}");
            Console.WriteLine($"Output: {outputDir}\n");

            // Find all JT files recursively
            string[] jtFiles = Directory.GetFiles(inputDir, "*.jt", SearchOption.AllDirectories);

            Console.WriteLine($"Found {jtFiles.Length} JT files\n");

            int successCount = 0;
            int failCount = 0;

            JTConverter converter = new JTConverter();

            for (int i = 0; i < jtFiles.Length; i++)
            {
                string jtFile = jtFiles[i];
                string relativePath = Path.GetRelativePath(inputDir, jtFile);
                string outputPath = Path.Combine(outputDir, Path.ChangeExtension(relativePath, ".obj"));

                Console.WriteLine($"[{i + 1}/{jtFiles.Length}] {relativePath}");

                try
                {
                    // Create output subdirectory
                    string subDir = Path.GetDirectoryName(outputPath);
                    if (!string.IsNullOrEmpty(subDir) && !Directory.Exists(subDir))
                    {
                        Directory.CreateDirectory(subDir);
                    }

                    converter.Convert(jtFile, outputPath);
                    Console.WriteLine($"  ✓ Success");
                    successCount++;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"  ✗ Failed: {ex.Message}");
                    failCount++;
                }

                Console.WriteLine();
            }

            Console.WriteLine($"\nBatch conversion complete:");
            Console.WriteLine($"  Successful: {successCount}");
            Console.WriteLine($"  Failed:     {failCount}");
            Console.WriteLine($"  Total:      {jtFiles.Length}");

            return failCount > 0 ? 1 : 0;
        }

        // Windows API to set DLL search path
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SetDllDirectory(string lpPathName);
    }

    /// <summary>
    /// Wrapper around JtReader.dll to convert JT files to OBJ format
    /// </summary>
    class JTConverter
    {
        public void Convert(string inputJT, string outputOBJ)
        {
            // NOTE: This is a skeleton - you'll need to fill in the actual
            // JtReader.dll API calls based on the decompiled code.
            //
            // Typical workflow:
            // 1. Load JT file using JT Open Toolkit
            // 2. Extract tessellation data (vertices, normals, triangles)
            // 3. Write to OBJ format

            // TODO: Implement actual JT reading
            // For now, throw an exception to guide implementation
            throw new NotImplementedException(
                "JTConverter needs implementation. " +
                "Decompile JtReader.dll to find the API:\n" +
                "1. Open C:\\tmp\\LineSimulator\\lib3\\JtReader.dll in dnSpy\n" +
                "2. Find classes like: JtReader.Opener, JtReader.Hierarchy\n" +
                "3. Look for methods like: Open(), GetGeometry(), etc.\n" +
                "4. Implement those calls here"
            );

            // EXAMPLE (pseudo-code based on typical JT SDK):
            /*
            using (var opener = new JtReader.Opener())
            {
                int result = opener.Open(inputJT, loadGeometry: true);
                if (result != 1) throw new Exception("Failed to open JT file");

                var root = opener.Root;
                if (root == null) throw new Exception("No geometry found");

                // Extract mesh data
                List<Vertex> vertices = new List<Vertex>();
                List<Triangle> triangles = new List<Triangle>();

                ExtractGeometry(root, vertices, triangles);

                // Write OBJ file
                WriteOBJ(outputOBJ, vertices, triangles);

                opener.Dispose();
            }
            */
        }

        // Helper methods (implement based on actual DLL API)
        /*
        private void ExtractGeometry(object hierarchy, List<Vertex> vertices, List<Triangle> triangles)
        {
            // Recursively walk hierarchy and extract geometry
        }

        private void WriteOBJ(string path, List<Vertex> vertices, List<Triangle> triangles)
        {
            using (StreamWriter writer = new StreamWriter(path))
            {
                writer.WriteLine("# OBJ file generated from JT");
                writer.WriteLine($"# Vertices: {vertices.Count}");
                writer.WriteLine($"# Triangles: {triangles.Count}");
                writer.WriteLine();

                // Write vertices
                foreach (var v in vertices)
                {
                    writer.WriteLine($"v {v.X} {v.Y} {v.Z}");
                }

                // Write normals
                foreach (var v in vertices)
                {
                    writer.WriteLine($"vn {v.NX} {v.NY} {v.NZ}");
                }

                // Write faces (1-indexed in OBJ)
                foreach (var t in triangles)
                {
                    writer.WriteLine($"f {t.V1+1}//{t.V1+1} {t.V2+1}//{t.V2+1} {t.V3+1}//{t.V3+1}");
                }
            }
        }
        */
    }

    struct Vertex
    {
        public float X, Y, Z;
        public float NX, NY, NZ; // Normal
    }

    struct Triangle
    {
        public int V1, V2, V3; // Vertex indices
    }
}
