using System.Collections.Generic;

namespace JTReaderWrapper
{
    // Data structures for JT file representation
    public class JTData
    {
        public string fileName { get; set; }
        public List<JTPartInfo> children { get; set; }
    }

    public class JTPartInfo
    {
        public string name { get; set; }
        public string type { get; set; }
        public JTTransform transform { get; set; }
        public JTMaterial material { get; set; }
        public JTGeometry geometry { get; set; }
        public List<JTPartInfo> children { get; set; }
    }

    public class JTTransform
    {
        public double[] matrix { get; set; }
    }

    public class JTMaterial
    {
        public double[] diffuse { get; set; }
        public double[] ambient { get; set; }
        public double[] specular { get; set; }
        public double[] emission { get; set; }
    }

    public class JTGeometry
    {
        public double[] vertices { get; set; }
        public int[] indices { get; set; }
        public double[] normals { get; set; }
    }
}
