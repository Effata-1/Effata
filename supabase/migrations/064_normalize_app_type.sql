-- Normalize genai_apps.app_type to 8 canonical values.
-- app_group (APP_GROUPS enum) is the canonical category;
-- app_type is a shorter display label. Both are now consistent.

UPDATE genai_apps SET app_type = 'AI Assistant'    WHERE app_type IN ('General Purpose AI Assistant', 'Enterprise AI Assistant', 'AI Collaboration Assistant');
UPDATE genai_apps SET app_type = 'Code Assistant'  WHERE app_type IN ('AI Code Assistant');
UPDATE genai_apps SET app_type = 'AI Writing'      WHERE app_type IN ('AI Writing & Communication');
UPDATE genai_apps SET app_type = 'AI Search'       WHERE app_type IN ('AI Search & Research Assistant');
UPDATE genai_apps SET app_type = 'AI Productivity' WHERE app_type IN ('AI Productivity Assistant');
UPDATE genai_apps SET app_type = 'Image Generator' WHERE app_type IN ('AI Image Generation');
UPDATE genai_apps SET app_type = 'AI Communication' WHERE app_type IN ('AI Meeting & Collaboration');
UPDATE genai_apps SET app_type = 'AI Analytics'    WHERE app_type IN ('Enterprise CRM AI');
