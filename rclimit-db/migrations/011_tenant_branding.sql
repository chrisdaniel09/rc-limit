-- 011: Tenant branding and utilization thresholds (docs/ui_ux_specification.md §3.5, §6.4, §15-2/3/4).
-- Edited directly in the database for now; there is no settings screen.
--
-- theme: the tenant theme document (§3.5). NULL means the platform default theme. The API validates it every time it
-- serves it and replaces any failing value with the platform default (§3.6), so a bad edit never reaches the browser.
-- Branding images are stored in Cloudflare R2; the document holds their https URLs only.
--
-- sub_limit_warn_pct / sub_limit_danger_pct: utilization tones for sub-limit and bank pool meters.
-- NULL means the default of 70 / 90. These constraints are the only validation, because the values are edited by hand.

ALTER TABLE system.tenant_settings
    ADD COLUMN theme                JSONB,
    ADD COLUMN sub_limit_warn_pct   INT,
    ADD COLUMN sub_limit_danger_pct INT,
    ADD CONSTRAINT ck_tenant_settings_theme_object  CHECK (theme IS NULL OR jsonb_typeof(theme) = 'object'),
    ADD CONSTRAINT ck_tenant_settings_warn_pct      CHECK (sub_limit_warn_pct IS NULL OR sub_limit_warn_pct BETWEEN 1 AND 100),
    ADD CONSTRAINT ck_tenant_settings_danger_pct    CHECK (sub_limit_danger_pct IS NULL OR sub_limit_danger_pct BETWEEN 1 AND 100),
    ADD CONSTRAINT ck_tenant_settings_warn_lt_danger CHECK (sub_limit_warn_pct IS NULL OR sub_limit_danger_pct IS NULL OR sub_limit_warn_pct < sub_limit_danger_pct);
