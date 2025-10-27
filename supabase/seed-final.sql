-- kinetiCORE Asset Library - Simple Seed Data
-- This version has no ON CONFLICT clauses to avoid constraint issues

-- Create demo users (with error handling)
DO $$
BEGIN
  -- Try to create auth users (may fail in hosted Supabase, that's OK)
  BEGIN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token, recovery_token,
      email_change_token_current, email_change_token_new
    ) VALUES
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
       'demo1@kineticore.local', '$2a$10$dummy1', NOW(), NOW(), NOW(),
       '{"provider": "email"}'::jsonb, '{"name": "Demo User 1"}'::jsonb,
       'authenticated', 'authenticated', '', '', '', ''),
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
       'demo2@kineticore.local', '$2a$10$dummy2', NOW(), NOW(), NOW(),
       '{"provider": "email"}'::jsonb, '{"name": "Demo User 2"}'::jsonb,
       'authenticated', 'authenticated', '', '', '', '');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped auth.users creation (may require special permissions)';
  END;

  -- Create user profiles
  BEGIN
    INSERT INTO public.user_profiles (id, email, name, role, preferences) VALUES
      ('00000000-0000-0000-0000-000000000001', 'demo1@kineticore.local', 'Demo User 1', 'individual', '{}'::jsonb),
      ('00000000-0000-0000-0000-000000000002', 'demo2@kineticore.local', 'Demo User 2', 'team_admin', '{}'::jsonb);
    RAISE NOTICE 'Created 2 user profiles';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Could not create user profiles - auth users do not exist';
    RAISE NOTICE 'Assets will be created when real users sign up';
  END;
END $$;

-- Create 5 public demo assets
DO $$
DECLARE
  v_owner1 UUID;
  v_owner2 UUID;
BEGIN
  -- Try to find demo users
  SELECT id INTO v_owner1 FROM public.user_profiles WHERE email = 'demo1@kineticore.local';
  SELECT id INTO v_owner2 FROM public.user_profiles WHERE email = 'demo2@kineticore.local';

  IF v_owner1 IS NULL THEN
    RAISE NOTICE 'No demo users found - skipping asset creation';
    RAISE NOTICE 'Assets will be created when users sign up and use Save to Library';
    RETURN;
  END IF;

  -- Create assets
  INSERT INTO public.assets (
    id, name, description, domain, asset_class, asset_type, loader_type,
    file_path, file_size, mime_type, checksum, thumbnail_url,
    owner_id, visibility, status, tags, search_keywords, capabilities,
    view_count, download_count, usage_count, rating, rating_count, popularity_score
  ) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fanuc LR Mate 200iD Robot',
     'Industrial 6-axis articulated robot arm. Compact with 7kg payload.',
     'robotics', 'machines', 'robot', 'urdf',
     '/assets/robots/fanuc-lr-mate-200id.urdf', 2048576, 'application/xml',
     'sha256:fanuc200id', '/thumbnails/fanuc-lr-mate-200id.jpg',
     v_owner1, 'public', 'published',
     ARRAY['robot', 'fanuc', 'industrial'], ARRAY['fanuc', 'lr-mate'],
     ARRAY['kinematics'], 45, 12, 8, 4.5, 6, 23.5),

    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'KUKA KR 120 R2500 Pro',
     'High-performance industrial robot. 120kg payload, 2500mm reach.',
     'robotics', 'machines', 'robot', 'urdf',
     '/assets/robots/kuka-kr-120.urdf', 3145728, 'application/xml',
     'sha256:kukakr120', '/thumbnails/kuka-kr-120.jpg',
     v_owner1, 'public', 'published',
     ARRAY['robot', 'kuka', 'heavy-duty'], ARRAY['kuka', 'kr120'],
     ARRAY['kinematics'], 38, 9, 5, 4.7, 4, 19.8),

    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ABB IRB 6700 Robot',
     'Versatile industrial robot with superior path accuracy.',
     'robotics', 'machines', 'robot', 'urdf',
     '/assets/robots/abb-irb-6700.urdf', 2621440, 'application/xml',
     'sha256:abbirb6700', '/thumbnails/abb-irb-6700.jpg',
     v_owner1, 'public', 'published',
     ARRAY['robot', 'abb', 'industrial'], ARRAY['abb', 'irb6700'],
     ARRAY['kinematics'], 52, 15, 11, 4.8, 8, 28.3),

    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Conveyor Belt System',
     'Modular conveyor belt for material handling and assembly lines.',
     'material-handling', 'machinery', 'conveyor', 'glb',
     '/assets/machinery/conveyor.glb', 1572864, 'model/gltf-binary',
     'sha256:conveyor01', '/thumbnails/conveyor.jpg',
     v_owner2, 'public', 'published',
     ARRAY['conveyor', 'material-handling'], ARRAY['conveyor', 'belt'],
     ARRAY['physics'], 29, 7, 4, 4.2, 3, 13.6),

    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Work Cell Layout',
     'Pre-configured robotic work cell with safety zones.',
     'manufacturing', 'structures', 'layout', 'glb',
     '/assets/layouts/work-cell.glb', 5242880, 'model/gltf-binary',
     'sha256:workcell01', '/thumbnails/work-cell.jpg',
     v_owner2, 'public', 'published',
     ARRAY['work-cell', 'layout', 'template'], ARRAY['workcell', 'template'],
     ARRAY['visualization'], 64, 18, 14, 4.6, 10, 32.4);

  -- Create metadata for assets
  INSERT INTO public.asset_metadata (
    asset_id, domain, asset_class, asset_type, category, subcategory,
    complexity, polygon_count, physics_enabled, collision_geometry,
    keywords, manufacturers, validation_status, quality_score
  ) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'robotics', 'machines', 'robot',
     'industrial-robots', 'articulated-arm', 'medium', 12500, true, true,
     ARRAY['6-axis', 'assembly'], ARRAY['Fanuc'], 'validated', 95),

    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'robotics', 'machines', 'robot',
     'industrial-robots', 'heavy-duty', 'high', 18000, true, true,
     ARRAY['heavy-payload', 'welding'], ARRAY['KUKA'], 'validated', 92),

    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'robotics', 'machines', 'robot',
     'industrial-robots', 'versatile', 'medium', 15200, true, true,
     ARRAY['high-precision'], ARRAY['ABB'], 'validated', 96),

    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'material-handling', 'machinery',
     'conveyor', 'conveyors', 'belt-conveyor', 'low', 3200, true, true,
     ARRAY['modular'], ARRAY['Generic'], 'validated', 88),

    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'manufacturing', 'structures',
     'layout', 'work-cells', 'robotic-cell', 'medium', 8500, false, false,
     ARRAY['template'], ARRAY['Generic'], 'validated', 90);

  RAISE NOTICE '✅ Created 5 public demo assets successfully!';
END $$;

-- Summary
DO $$
DECLARE
  v_asset_count INTEGER;
  v_public_count INTEGER;
  v_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_asset_count FROM public.assets;
  SELECT COUNT(*) INTO v_public_count FROM public.assets WHERE visibility = 'public';
  SELECT COUNT(*) INTO v_user_count FROM public.user_profiles;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'kinetiCORE Asset Library Setup Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Demo users: %', v_user_count;
  RAISE NOTICE 'Total assets: %', v_asset_count;
  RAISE NOTICE 'Public assets: %', v_public_count;
  RAISE NOTICE '';

  IF v_asset_count = 0 THEN
    RAISE NOTICE '⚠️  No assets created (users may not exist)';
    RAISE NOTICE 'Database schema is ready for production use!';
  ELSE
    RAISE NOTICE '✅ Your asset library is ready!';
    RAISE NOTICE 'Run: node scripts/test-cloud-connection.js';
  END IF;

  RAISE NOTICE '========================================';
END $$;
