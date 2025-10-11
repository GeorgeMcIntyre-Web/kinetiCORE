using System;
using System.IO;
using System.Text.Json;

namespace JTReaderWrapper
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.WriteLine("Usage: JTReaderWrapper.exe <jt_file_path>");
                return;
            }

            string inputFile = args[0];
            if (!File.Exists(inputFile))
            {
                Console.WriteLine($"File not found: {inputFile}");
                return;
            }

            Console.WriteLine($"============================================");
            Console.WriteLine($"JT Reader Wrapper - Real JT Mesh Extraction");
            Console.WriteLine($"============================================");
            Console.WriteLine($"Processing JT file: {inputFile}");
            Console.WriteLine();

            JTData result = null;

            try
            {
                // Try real JT Reader first
                result = RealJTReader.ReadJTFile(inputFile);
                Console.WriteLine("[SUCCESS] Real JT Reader extraction successful!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Real JT Reader failed: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");

                // If real reader fails, use fallback
                Console.WriteLine();
                Console.WriteLine("[FALLBACK] Using fallback geometry generation...");
                result = FallbackReader.AnalyzeJTFileStructure(inputFile);
            }

            if (result != null)
            {
                string json = JsonSerializer.Serialize(result, new JsonSerializerOptions
                {
                    WriteIndented = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });
                Console.WriteLine();
                Console.WriteLine("============================================");
                Console.WriteLine("JSON Output:");
                Console.WriteLine("============================================");
                Console.WriteLine(json);
            }
            else
            {
                Console.WriteLine("[FATAL ERROR] Failed to process JT file");
            }
        }
    }
}
