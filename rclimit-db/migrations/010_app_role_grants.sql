-- 010: Grants for the application role.
-- Applied only when a role named app_user exists, so databases where the API connects as the owner are unaffected.
-- Default privileges cover tables created by later migrations.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT USAGE ON SCHEMA system, auth, accounting, leads, public TO app_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA system, auth, accounting, leads, public TO app_user;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA system, auth, accounting, leads, public TO app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA system, auth, accounting, leads, public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA system, auth, accounting, leads, public
            GRANT USAGE, SELECT ON SEQUENCES TO app_user;
    END IF;
END
$$;
