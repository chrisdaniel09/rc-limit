-- Deletes every RCLimit object and all data in the connected database: the system, auth, accounting, loans, leads and partners
-- schemas, everything in public, and the migration history. The database itself is kept.
-- THIS CANNOT BE UNDONE. Check which database you are connected to before running it.
--
--   psql -h localhost -U postgres -d rclimit -f scripts/drop_all.sql
--   or: .\run_migrations.ps1 -Reset

\echo Dropping all RCLimit schemas and data in database :DBNAME

BEGIN;

DROP SCHEMA IF EXISTS leads CASCADE;
DROP SCHEMA IF EXISTS loans CASCADE;
DROP SCHEMA IF EXISTS partners CASCADE;
DROP SCHEMA IF EXISTS accounting CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS system CASCADE;

-- public holds only the migration history. Recreate it with the
-- PostgreSQL 15+ defaults: owned by the database owner, usable by everyone.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC;

COMMIT;

\echo Done. Run run_migrations.ps1 to rebuild the schema.
