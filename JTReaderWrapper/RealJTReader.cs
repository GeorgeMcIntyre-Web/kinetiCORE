using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using JtReader;

namespace JTReaderWrapper
{
    /// <summary>
    /// Real JT Reader - Uses actual JtReader.dll API to extract mesh data
    /// </summary>
    public class RealJTReader
    {
        public static JTData ReadJTFile(string filePath)
        {
            Console.WriteLine($"[RealJTReader] Opening JT file: {filePath}");

            using (var opener = new Opener())
            {
                // Open the JT file with geometry loading enabled
                int result = opener.Open(filePath, loadGeometry: true);

                if (result != 1)
                {
                    throw new Exception($"Failed to open JT file. Error code: {result}");
                }

                Console.WriteLine($"[RealJTReader] Successfully opened JT file");

                // Get root hierarchy
                Hierarchy root = opener.Root;

                if (root == null)
                {
                    throw new Exception("Root hierarchy is null");
                }

                Console.WriteLine($"[RealJTReader] Root hierarchy type: {root.GetType().Name}");
                Console.WriteLine($"[RealJTReader] Root name: {root.Name}");

                // Create JT data structure
                var jtData = new JTData
                {
                    fileName = Path.GetFileNameWithoutExtension(filePath),
                    children = new List<JTPartInfo>()
                };

                // Process hierarchy recursively
                ProcessHierarchy(root, jtData.children, level: 0);

                Console.WriteLine($"[RealJTReader] Extracted {jtData.children.Count} top-level nodes");

                return jtData;
            }
        }

        private static void ProcessHierarchy(Hierarchy hierarchy, List<JTPartInfo> parts, int level)
        {
            string indent = new string(' ', level * 2);
            Console.WriteLine($"{indent}Processing: {hierarchy.Name} ({hierarchy.GetType().Name})");

            var partInfo = new JTPartInfo
            {
                name = hierarchy.Name ?? "Unnamed",
                type = hierarchy.GetType().Name,
                transform = ExtractTransform(hierarchy),
                material = ExtractMaterial(hierarchy)
            };

            // Check if this is an Assembly with children
            if (hierarchy is Assembly assembly)
            {
                Console.WriteLine($"{indent}  Assembly with {assembly.Children.Count} children");
                partInfo.children = new List<JTPartInfo>();

                foreach (var child in assembly.Children)
                {
                    ProcessHierarchy(child, partInfo.children, level + 1);
                }
            }
            // Check if this is a Part with geometry
            else if (hierarchy is Part part)
            {
                Console.WriteLine($"{indent}  Part with geometry");
                partInfo.geometry = ExtractGeometry(part);

                if (partInfo.geometry != null)
                {
                    int vertexCount = partInfo.geometry.vertices?.Length / 3 ?? 0;
                    int triangleCount = partInfo.geometry.indices?.Length / 3 ?? 0;
                    Console.WriteLine($"{indent}    Vertices: {vertexCount}, Triangles: {triangleCount}");
                }
            }

            parts.Add(partInfo);
        }

        private static JTTransform ExtractTransform(Hierarchy hierarchy)
        {
            try
            {
                var matrix = hierarchy.Transform;

                return new JTTransform
                {
                    matrix = new double[]
                    {
                        matrix.M11, matrix.M12, matrix.M13, matrix.M14,
                        matrix.M21, matrix.M22, matrix.M23, matrix.M24,
                        matrix.M31, matrix.M32, matrix.M33, matrix.M34,
                        matrix.M41, matrix.M42, matrix.M43, matrix.M44
                    }
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RealJTReader] Warning: Failed to extract transform: {ex.Message}");
                return CreateIdentityTransform();
            }
        }

        private static JTTransform CreateIdentityTransform()
        {
            return new JTTransform
            {
                matrix = new double[]
                {
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                }
            };
        }

        private static JTMaterial ExtractMaterial(Hierarchy hierarchy)
        {
            try
            {
                if (!hierarchy.HasMaterial)
                {
                    return null;
                }

                var material = new JTMaterial();

                if (hierarchy.HasDiffuse && hierarchy.Diffuse != null && hierarchy.Diffuse.Length >= 4)
                {
                    material.diffuse = new double[]
                    {
                        hierarchy.Diffuse[0],
                        hierarchy.Diffuse[1],
                        hierarchy.Diffuse[2],
                        hierarchy.Diffuse[3]
                    };
                }

                if (hierarchy.HasAmbient && hierarchy.Ambient != null && hierarchy.Ambient.Length >= 4)
                {
                    material.ambient = new double[]
                    {
                        hierarchy.Ambient[0],
                        hierarchy.Ambient[1],
                        hierarchy.Ambient[2],
                        hierarchy.Ambient[3]
                    };
                }

                if (hierarchy.HasSpecular && hierarchy.Specular != null && hierarchy.Specular.Length >= 4)
                {
                    material.specular = new double[]
                    {
                        hierarchy.Specular[0],
                        hierarchy.Specular[1],
                        hierarchy.Specular[2],
                        hierarchy.Specular[3]
                    };
                }

                if (hierarchy.HasEmission && hierarchy.Emission != null && hierarchy.Emission.Length >= 4)
                {
                    material.emission = new double[]
                    {
                        hierarchy.Emission[0],
                        hierarchy.Emission[1],
                        hierarchy.Emission[2],
                        hierarchy.Emission[3]
                    };
                }

                return material;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RealJTReader] Warning: Failed to extract material: {ex.Message}");
                return null;
            }
        }

        private static JTGeometry ExtractGeometry(Part part)
        {
            try
            {
                // Convert Part to Model3D to extract geometry
                var model = part.ToModel(lod: 0, freeze: false);

                if (model == null)
                {
                    Console.WriteLine($"[RealJTReader] Warning: ToModel returned null");
                    return null;
                }

                // Extract geometry from Model3D
                var geometry = ExtractGeometryFromModel(model);

                if (geometry == null || geometry.vertices == null || geometry.vertices.Length == 0)
                {
                    Console.WriteLine($"[RealJTReader] Warning: No geometry extracted from model");
                    return null;
                }

                return geometry;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RealJTReader] Warning: Failed to extract geometry: {ex.Message}");
                Console.WriteLine($"[RealJTReader] Stack trace: {ex.StackTrace}");
                return null;
            }
        }

        private static JTGeometry ExtractGeometryFromModel(System.Windows.Media.Media3D.Model3D model)
        {
            var allVertices = new List<double>();
            var allIndices = new List<int>();
            var allNormals = new List<double>();

            ExtractGeometryRecursive(model, allVertices, allIndices, allNormals);

            if (allVertices.Count == 0)
            {
                return null;
            }

            return new JTGeometry
            {
                vertices = allVertices.ToArray(),
                indices = allIndices.ToArray(),
                normals = allNormals.ToArray()
            };
        }

        private static void ExtractGeometryRecursive(
            System.Windows.Media.Media3D.Model3D model,
            List<double> vertices,
            List<int> indices,
            List<double> normals)
        {
            if (model is System.Windows.Media.Media3D.GeometryModel3D geometryModel)
            {
                if (geometryModel.Geometry is System.Windows.Media.Media3D.MeshGeometry3D mesh)
                {
                    int vertexOffset = vertices.Count / 3;

                    // Extract vertices
                    foreach (var position in mesh.Positions)
                    {
                        vertices.Add(position.X);
                        vertices.Add(position.Y);
                        vertices.Add(position.Z);
                    }

                    // Extract indices
                    foreach (var index in mesh.TriangleIndices)
                    {
                        indices.Add(vertexOffset + index);
                    }

                    // Extract normals
                    if (mesh.Normals != null && mesh.Normals.Count > 0)
                    {
                        foreach (var normal in mesh.Normals)
                        {
                            normals.Add(normal.X);
                            normals.Add(normal.Y);
                            normals.Add(normal.Z);
                        }
                    }
                    else
                    {
                        // Generate default normals if not present
                        for (int i = 0; i < mesh.Positions.Count; i++)
                        {
                            normals.Add(0);
                            normals.Add(1);
                            normals.Add(0);
                        }
                    }
                }
            }
            else if (model is System.Windows.Media.Media3D.Model3DGroup group)
            {
                foreach (var child in group.Children)
                {
                    ExtractGeometryRecursive(child, vertices, indices, normals);
                }
            }
        }
    }

}
