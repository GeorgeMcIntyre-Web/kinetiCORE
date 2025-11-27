import struct
import json
import sys
import os

def parse_glb(file_path):
    with open(file_path, 'rb') as f:
        # Read header
        magic = f.read(4)
        if magic != b'glTF':
            print(f"Error: {file_path} is not a valid GLB file.")
            return

        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]

        # Read chunks
        while f.tell() < length:
            chunk_length = struct.unpack('<I', f.read(4))[0]
            chunk_type = f.read(4)
            
            if chunk_type == b'JSON':
                json_data = f.read(chunk_length)
                return json.loads(json_data.decode('utf-8'))
            else:
                f.seek(chunk_length, 1) # Skip other chunks

    return None

def get_node_hierarchy(gltf_data):
    nodes = gltf_data.get('nodes', [])
    meshes = gltf_data.get('meshes', [])
    accessors = gltf_data.get('accessors', [])
    
    hierarchy = {}
    root_nodes = []
    
    # Build adjacency list
    children_map = {}
    for i, node in enumerate(nodes):
        if 'children' in node:
            children_map[i] = node['children']
        
        # Check if this node is a child of anyone
        is_child = False
        for parent in nodes:
            if 'children' in parent and i in parent['children']:
                is_child = True
                break
        if not is_child:
            root_nodes.append(i)

    return nodes, meshes, accessors, root_nodes

def get_mesh_point_count(mesh_index, meshes, accessors):
    if mesh_index is None or mesh_index >= len(meshes):
        return 0
    
    mesh = meshes[mesh_index]
    total_points = 0
    
    for primitive in mesh.get('primitives', []):
        attributes = primitive.get('attributes', {})
        if 'POSITION' in attributes:
            accessor_index = attributes['POSITION']
            if accessor_index < len(accessors):
                total_points += accessors[accessor_index].get('count', 0)
    
    return total_points

def print_tree(nodes, meshes, accessors, node_index, prefix="", is_last=True):
    node = nodes[node_index]
    name = node.get('name', f"Node_{node_index}")
    mesh_index = node.get('mesh')
    point_count = get_mesh_point_count(mesh_index, meshes, accessors)
    
    mesh_info = ""
    if mesh_index is not None:
        mesh_info = f" [Mesh: {mesh_index}, Points: {point_count}]"
    
    connector = "└── " if is_last else "├── "
    print(f"{prefix}{connector}{name}{mesh_info}")
    
    children = node.get('children', [])
    for i, child_index in enumerate(children):
        is_last_child = (i == len(children) - 1)
        new_prefix = prefix + ("    " if is_last else "│   ")
        print_tree(nodes, meshes, accessors, child_index, new_prefix, is_last_child)

def analyze_file(file_path):
    print(f"\nAnalyzing: {os.path.basename(file_path)}")
    print("=" * 50)
    
    try:
        gltf_data = parse_glb(file_path)
        if not gltf_data:
            return

        nodes, meshes, accessors, root_nodes = get_node_hierarchy(gltf_data)
        
        for root in root_nodes:
            print_tree(nodes, meshes, accessors, root)
            
    except Exception as e:
        print(f"Error analyzing file:")
        print(f"File: {file_path}")
        print(f"Exception: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analyze_glb.py <file_path> [file_path ...]")
        sys.exit(1)
        
    output_file = None
    files_to_process = []
    
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '-o':
            if i + 1 < len(args):
                output_file = args[i+1]
                i += 2
                continue
        elif arg.startswith('@'):
            list_file = arg[1:]
            try:
                with open(list_file, 'r', encoding='utf-8') as f:
                    files_to_process.extend([line.strip() for line in f if line.strip()])
            except Exception as e:
                print(f"Error reading list file {list_file}: {e}")
        else:
            files_to_process.append(arg)
        i += 1

    # Redirect stdout to file if specified
    if output_file:
        sys.stdout = open(output_file, 'w', encoding='utf-8')

    for file_path in files_to_process:
        analyze_file(file_path)
