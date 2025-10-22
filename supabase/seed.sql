-- kinetiCORE Asset Management Seed Data
-- File: supabase/seed.sql
-- Owner: George

-- Insert sample user profiles (these would be created by Supabase Auth in real usage)
-- For development, we'll create some sample users

-- Sample teams
INSERT INTO public.teams (id, name, description, owner_id, settings) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Robotics Team Alpha', 'Advanced robotics development team', '00000000-0000-0000-0000-000000000001', '{"allowPublicAssets": true, "requireApprovalForSharing": false}'),
  ('22222222-2222-2222-2222-222222222222', 'Manufacturing Team Beta', 'Industrial manufacturing solutions', '00000000-0000-0000-0000-000000000002', '{"allowPublicAssets": false, "requireApprovalForSharing": true}');

-- Sample team members
INSERT INTO public.team_members (team_id, user_id, role, invited_by) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'edit', '00000000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 'view', '00000000-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000005', 'admin', '00000000-0000-0000-0000-000000000002');

-- Sample assets
INSERT INTO public.assets (
  id, name, description, domain, asset_class, asset_type, loader_type,
  file_path, file_size, mime_type, checksum, thumbnail_url,
  owner_id, visibility, status, tags, search_keywords, capabilities,
  view_count, download_count, usage_count, rating, rating_count, popularity_score
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Fanuc LR Mate 200iD Robot',
    'Industrial 6-axis articulated robot arm for assembly and material handling',
    'robotics',
    'machines',
    'robot',
    'urdf',
    '/assets/robots/fanuc-lr-mate-200id.urdf',
    2048576,
    'application/xml',
    'sha256:abc123def456',
    '/thumbnails/fanuc-lr-mate-200id.jpg',
    '00000000-0000-0000-0000-000000000001',
    'public',
    'published',
    ARRAY['robot', 'fanuc', 'industrial', '6-axis', 'assembly'],
    ARRAY['fanuc', 'lr-mate', '200id', 'robot', 'industrial', 'assembly'],
    ARRAY['kinematics', 'collision-detection', 'path-planning'],
    45,
    12,
    8,
    4.5,
    6,
    23.5
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'KUKA KR 120 R2500 Pro',
    'Heavy-duty industrial robot for welding and material handling applications',
    'robotics',
    'machines',
    'robot',
    'urdf',
    '/assets/robots/kuka-kr-120-r2500.urdf',
    3072000,
    'application/xml',
    'sha256:def456ghi789',
    '/thumbnails/kuka-kr-120-r2500.jpg',
    '00000000-0000-0000-0000-000000000002',
    'team',
    'published',
    ARRAY['robot', 'kuka', 'industrial', 'welding', 'heavy-duty'],
    ARRAY['kuka', 'kr-120', 'r2500', 'robot', 'welding', 'industrial'],
    ARRAY['kinematics', 'collision-detection', 'welding', 'path-planning'],
    32,
    8,
    5,
    4.2,
    4,
    18.2
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Conveyor Belt System',
    'Modular conveyor belt system for material transport',
    'manufacturing',
    'structures',
    'conveyor',
    'glb',
    '/assets/conveyors/conveyor-belt-system.glb',
    1536000,
    'model/gltf-binary',
    'sha256:ghi789jkl012',
    '/thumbnails/conveyor-belt-system.jpg',
    '00000000-0000-0000-0000-000000000003',
    'private',
    'draft',
    ARRAY['conveyor', 'belt', 'transport', 'manufacturing'],
    ARRAY['conveyor', 'belt', 'system', 'transport', 'manufacturing'],
    ARRAY['animation', 'collision-detection'],
    15,
    3,
    2,
    3.8,
    2,
    8.6
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'ABB IRB 6700 Robot',
    'High-precision industrial robot for assembly and machining',
    'robotics',
    'machines',
    'robot',
    'urdf',
    '/assets/robots/abb-irb-6700.urdf',
    2560000,
    'application/xml',
    'sha256:jkl012mno345',
    '/thumbnails/abb-irb-6700.jpg',
    '00000000-0000-0000-0000-000000000001',
    'organization',
    'published',
    ARRAY['robot', 'abb', 'irb-6700', 'precision', 'assembly'],
    ARRAY['abb', 'irb-6700', 'robot', 'precision', 'assembly', 'machining'],
    ARRAY['kinematics', 'collision-detection', 'precision-control'],
    28,
    7,
    4,
    4.7,
    5,
    16.1
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'Work Cell Layout',
    'Complete work cell layout with robot, conveyor, and safety equipment',
    'manufacturing',
    'structures',
    'workcell',
    'glb',
    '/assets/workcells/work-cell-layout.glb',
    5120000,
    'model/gltf-binary',
    'sha256:mno345pqr678',
    '/thumbnails/work-cell-layout.jpg',
    '00000000-0000-0000-0000-000000000002',
    'public',
    'published',
    ARRAY['workcell', 'layout', 'manufacturing', 'safety', 'complete'],
    ARRAY['workcell', 'layout', 'manufacturing', 'safety', 'complete', 'cell'],
    ARRAY['animation', 'collision-detection', 'safety-zones'],
    67,
    18,
    12,
    4.8,
    9,
    35.4
  );

-- Sample asset metadata
INSERT INTO public.asset_metadata (
  asset_id, domain, asset_class, asset_type, category, subcategory,
  complexity, polygon_count, texture_count, material_count, animation_count,
  physics_enabled, collision_geometry, bounding_box, center_of_mass,
  keywords, manufacturers, models, part_numbers, standards, certifications,
  validation_status, validation_errors, quality_score, optimization_level,
  ai_tags, ai_description, ai_category, ai_complexity, ai_use_cases,
  ai_technical_specs, ai_confidence
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'robotics',
    'machines',
    'robot',
    'industrial',
    'articulated',
    'complex',
    125000,
    8,
    12,
    6,
    true,
    true,
    '{"min": [-0.5, -0.5, -0.5], "max": [0.5, 0.5, 0.5]}',
    '{"x": 0, "y": 0, "z": 0.2}',
    ARRAY['fanuc', 'lr-mate', '200id', 'robot', 'industrial', 'assembly'],
    ARRAY['fanuc'],
    ARRAY['lr-mate-200id'],
    ARRAY['LR-MATE-200ID'],
    ARRAY['ISO-10218', 'ANSI-RIA-15.06'],
    ARRAY['CE', 'UL'],
    'validated',
    ARRAY[]::TEXT[],
    95,
    'professional',
    ARRAY['industrial-robot', '6-axis', 'articulated', 'assembly'],
    'Industrial 6-axis articulated robot arm designed for assembly and material handling applications',
    'industrial-robotics',
    'complex',
    ARRAY['assembly', 'material-handling', 'pick-and-place', 'welding'],
    '{"payload": 7, "reach": 911, "repeatability": 0.05, "axes": 6}',
    0.92
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'robotics',
    'machines',
    'robot',
    'industrial',
    'articulated',
    'complex',
    180000,
    12,
    15,
    8,
    true,
    true,
    '{"min": [-0.8, -0.8, -0.8], "max": [0.8, 0.8, 0.8]}',
    '{"x": 0, "y": 0, "z": 0.3}',
    ARRAY['kuka', 'kr-120', 'r2500', 'robot', 'welding', 'heavy-duty'],
    ARRAY['kuka'],
    ARRAY['kr-120-r2500'],
    ARRAY['KR-120-R2500'],
    ARRAY['ISO-10218', 'ANSI-RIA-15.06'],
    ARRAY['CE', 'UL'],
    'validated',
    ARRAY[]::TEXT[],
    92,
    'professional',
    ARRAY['industrial-robot', '6-axis', 'welding', 'heavy-duty'],
    'Heavy-duty industrial robot optimized for welding and material handling applications',
    'industrial-robotics',
    'complex',
    ARRAY['welding', 'material-handling', 'heavy-lifting', 'automation'],
    '{"payload": 120, "reach": 2500, "repeatability": 0.06, "axes": 6}',
    0.89
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'manufacturing',
    'structures',
    'conveyor',
    'material-handling',
    'belt-conveyor',
    'medium',
    45000,
    4,
    6,
    2,
    true,
    true,
    '{"min": [-2.0, -0.5, -0.5], "max": [2.0, 0.5, 0.5]}',
    '{"x": 0, "y": 0, "z": 0.1}',
    ARRAY['conveyor', 'belt', 'transport', 'manufacturing'],
    ARRAY['flexco', 'habasit'],
    ARRAY['belt-conveyor-standard'],
    ARRAY['BC-STD-001'],
    ARRAY['ISO-5048'],
    ARRAY['CE'],
    'validated',
    ARRAY[]::TEXT[],
    78,
    'advanced',
    ARRAY['conveyor', 'belt', 'transport', 'material-handling'],
    'Modular conveyor belt system for efficient material transport',
    'material-handling',
    'medium',
    ARRAY['material-transport', 'assembly-line', 'packaging'],
    '{"length": 4.0, "width": 0.6, "speed": 0.5, "capacity": 50}',
    0.76
  );

-- Sample asset versions
INSERT INTO public.asset_versions (
  asset_id, version_number, branch_name, name, description,
  file_name, file_path, file_size, checksum, mime_type,
  created_by, status, is_stable, is_public, changes
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '1.0.0',
    'main',
    'Fanuc LR Mate 200iD Robot',
    'Initial release with basic kinematics',
    'fanuc-lr-mate-200id.urdf',
    '/assets/robots/fanuc-lr-mate-200id.urdf',
    2048576,
    'sha256:abc123def456',
    'application/xml',
    '00000000-0000-0000-0000-000000000001',
    'approved',
    true,
    true,
    '[{"type": "added", "field": "asset", "description": "Initial robot model", "impact": "medium"}]'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '1.1.0',
    'main',
    'Fanuc LR Mate 200iD Robot',
    'Added collision geometry and improved materials',
    'fanuc-lr-mate-200id-v1.1.urdf',
    '/assets/robots/fanuc-lr-mate-200id-v1.1.urdf',
    2150400,
    'sha256:abc123def789',
    'application/xml',
    '00000000-0000-0000-0000-000000000001',
    'approved',
    true,
    true,
    '[{"type": "modified", "field": "collision", "description": "Added collision geometry", "impact": "medium"}, {"type": "modified", "field": "materials", "description": "Improved material definitions", "impact": "low"}]'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '1.0.0',
    'main',
    'KUKA KR 120 R2500 Pro',
    'Initial release with welding capabilities',
    'kuka-kr-120-r2500.urdf',
    '/assets/robots/kuka-kr-120-r2500.urdf',
    3072000,
    'sha256:def456ghi789',
    'application/xml',
    '00000000-0000-0000-0000-000000000002',
    'approved',
    true,
    true,
    '[{"type": "added", "field": "asset", "description": "Initial robot model with welding tools", "impact": "high"}]'::jsonb
  );

-- Sample asset collaborators
INSERT INTO public.asset_collaborators (
  asset_id, user_id, permission, added_by, status, access_level
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000003',
    'edit',
    '00000000-0000-0000-0000-000000000001',
    'active',
    'full'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000005',
    'view',
    '00000000-0000-0000-0000-000000000002',
    'active',
    'limited'
  );

-- Sample asset comments
INSERT INTO public.asset_comments (
  asset_id, version_id, user_id, content, type, status, mentions
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000003',
    'Great robot model! The kinematics look accurate. @john can you check the joint limits?',
    'comment',
    'active',
    ARRAY['00000000-0000-0000-0000-000000000004']
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000005',
    'The welding tool attachment needs better collision detection',
    'suggestion',
    'active',
    ARRAY[]::UUID[]
  );

-- Sample asset share requests
INSERT INTO public.asset_share_requests (
  asset_id, requested_by, requested_from, permission, message, status, created_at
) VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    'edit',
    'Please review this conveyor design for our assembly line project',
    'pending',
    NOW() - INTERVAL '2 hours'
  );

-- Sample asset analytics
INSERT INTO public.asset_analytics (
  asset_id, user_id, event_type, event_data, session_id, created_at
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000003',
    'view',
    '{"source": "search", "query": "fanuc robot"}',
    'session_123',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000004',
    'download',
    '{"format": "urdf", "version": "1.1.0"}',
    'session_456',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000005',
    'use',
    '{"project": "welding-cell", "action": "simulation"}',
    'session_789',
    NOW() - INTERVAL '15 minutes'
  );
