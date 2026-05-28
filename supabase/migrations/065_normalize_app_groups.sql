-- Normalize genai_apps.app_group to AI-first consistent naming.
-- All category names now start with "AI" for uniformity.

UPDATE genai_apps SET app_group = 'AI Productivity Copilots'    WHERE app_group = 'Productivity Copilots';
UPDATE genai_apps SET app_group = 'AI Coding Assistants'        WHERE app_group = 'Coding Assistants';
UPDATE genai_apps SET app_group = 'AI Document Tools'           WHERE app_group = 'Document AI';
UPDATE genai_apps SET app_group = 'AI Data Analysis'            WHERE app_group = 'Data Analysis AI';
UPDATE genai_apps SET app_group = 'AI Search & Knowledge'       WHERE app_group = 'Search & Knowledge AI';
UPDATE genai_apps SET app_group = 'AI Customer Support'         WHERE app_group = 'Customer Support AI';
UPDATE genai_apps SET app_group = 'AI Sales & CRM'              WHERE app_group = 'Sales & CRM AI';
UPDATE genai_apps SET app_group = 'AI Workflow & Automation'    WHERE app_group = 'Workflow & Automation AI';
UPDATE genai_apps SET app_group = 'AI Creative & Design'        WHERE app_group = 'Creative & Design AI';
UPDATE genai_apps SET app_group = 'AI Meeting & Transcription'  WHERE app_group = 'Meeting & Transcription AI';
UPDATE genai_apps SET app_group = 'AI Browser Extensions'       WHERE app_group = 'Browser AI Extensions';
UPDATE genai_apps SET app_group = 'AI Model Platforms & APIs'   WHERE app_group = 'Model Platforms & AI APIs';
UPDATE genai_apps SET app_group = 'AI Code Execution & Notebooks' WHERE app_group = 'AI Code Execution & Notebook Tools';
