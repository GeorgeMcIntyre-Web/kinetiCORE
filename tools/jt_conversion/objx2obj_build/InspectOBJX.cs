/**
 * OBJX Inspector - Prints structure of OBJX file
 * Helps understand ObjXFile.dll API
 */

using System;
using System.IO;
using System.Reflection;
using System.Linq;

class InspectOBJX
{
    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: InspectOBJX.exe <input.objx>");
            return;
        }

        string objxPath = args[0];

        if (!File.Exists(objxPath))
        {
            Console.Error.WriteLine("ERROR: File not found: " + objxPath);
            return;
        }

        try
        {
            // Load ObjXFile assembly
            Assembly objxAsm = Assembly.LoadFrom("ObjXFile.dll");

            Console.WriteLine("=== ObjXFile.dll Assembly Info ===");
            Console.WriteLine();

            // List all types
            Console.WriteLine("Types in ObjXFile.dll:");
            Type[] types;
            try
            {
                types = objxAsm.GetTypes();
            }
            catch (ReflectionTypeLoadException ex)
            {
                Console.WriteLine("WARNING: Some types failed to load:");
                foreach (var loaderEx in ex.LoaderExceptions)
                {
                    if (loaderEx != null)
                        Console.WriteLine("  " + loaderEx.Message);
                }
                types = ex.Types.Where(t => t != null).ToArray();
                Console.WriteLine();
                Console.WriteLine("Successfully loaded " + types.Length + " types:");
            }

            foreach (Type t in types)
            {
                if (t.IsPublic)
                {
                    Console.WriteLine("  " + t.FullName);

                    // Show public methods and properties
                    foreach (var method in t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly))
                    {
                        Console.WriteLine("    Method: " + method.Name + "(" +
                            string.Join(", ", Array.ConvertAll(method.GetParameters(), p => p.ParameterType.Name + " " + p.Name)) + ") : " + method.ReturnType.Name);
                    }

                    foreach (var prop in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
                    {
                        Console.WriteLine("    Property: " + prop.PropertyType.Name + " " + prop.Name);
                    }

                    Console.WriteLine();
                }
            }

            Console.WriteLine();
            Console.WriteLine("=== Attempting to load OBJX file ===");
            Console.WriteLine("File: " + objxPath);
            Console.WriteLine("Size: " + new FileInfo(objxPath).Length + " bytes");
            Console.WriteLine();

            // Try to find ObjX class and Load method
            Type objxType = objxAsm.GetType("ObjXFile.ObjX");
            if (objxType != null)
            {
                Console.WriteLine("Found ObjX class!");

                // Try to find Load method
                MethodInfo loadMethod = objxType.GetMethod("Load", BindingFlags.Public | BindingFlags.Static);
                if (loadMethod != null)
                {
                    Console.WriteLine("Found Load method: " + loadMethod);
                    var parameters = loadMethod.GetParameters();
                    Console.WriteLine("Parameters: " + string.Join(", ", Array.ConvertAll(parameters, p => p.ParameterType.Name + " " + p.Name)));
                }
                else
                {
                    Console.WriteLine("No static Load method found");
                }
            }
            else
            {
                Console.WriteLine("ObjX class not found");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("ERROR: " + ex.Message);
            Console.Error.WriteLine(ex.StackTrace);
        }
    }
}
