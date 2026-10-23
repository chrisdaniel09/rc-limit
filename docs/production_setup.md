Fix before you commit

1. Production config is wrong for the current setup. appsettings.json (the file Azure uses) now has Auth:DeploymentProfile = SameSite, with CORS empty. The production UI is on a different host, so that profile would reject it. It also requires an edge shared secret that Azure doesn't have yet, and startup would fail. Production should be CrossSite until the Static Web Apps cutover.
2. Auth:Edge:DisableInDevelopment is true in appsettings.json. Startup rejects that setting outside Development, so production would fail to start.
3. Committed database password. appsettings.Development.json is tracked and contains the Neon connection string with its password. Rotate that password, then remove it from the file and use user-secrets or an environment variable.
4. Committed JWT secret. Jwt:Secret in appsettings.json is a known value, so if Azure ever ran without Jwt__Secret, it would start with that known secret. Make the base value empty, so startup fails loudly without the variable. The value is also in git history, so rotate it.
5. Default password in run_migrations.ps1. The default -Password "dc@2026" is committed. Remove the default and make the parameter mandatory.

Two smaller points: the seed admin password Admin@123 is in 001_seed_data.sql, so don't run the seed against production. The runner applies every seed file to whatever database it points at.

Proposed appsettings.json (production, interim)

"Auth": {
  "DeploymentProfile": "CrossSite",
  "CookieName": "__Secure-rclimit_rt",
  "Edge": { "DisableInDevelopment": false, "SharedSecretHeader": "X-Edge-Secret" }
},
"Cors": { "AllowedOrigins": [ "https://ashy-hill-006ad3900.4.azurestaticapps.net" ] },
"Jwt": { "Secret": "", "Issuer": "RCLimit", "Audience": "RCLimit.UI", ... }

appsettings.Development.json keeps SameSite, DisableInDevelopment: true and empty CORS.

Azure App Service settings (rclimit, Production slot)

┌──────────────────────────────────────┬───────────────────────────────────────────────────┬───────────────────────────────────────────────────┐
│                 Name                 │                       Value                       │                        Why                        │
├──────────────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ ASPNETCORE_ENVIRONMENT               │ Production                                        │ Stops the Development file being applied.         │
├──────────────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ ConnectionStrings__DefaultConnection │ Production Postgres connection string             │ Database. Use a new credential.                   │
├──────────────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Jwt__Secret                          │ Random value of 32 or more characters, ideally 64 │ Signs access tokens. Startup fails without it.    │
├──────────────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Auth__DeploymentProfile              │ CrossSite                                         │ Only needed if you don't change appsettings.json. │
├──────────────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Cors__AllowedOrigins__0              │ https://ashy-hill-006ad3900.4.azurestaticapps.net │ Only needed if you don't change appsettings.json. │
└──────────────────────────────────────┴───────────────────────────────────────────────────┴───────────────────────────────────────────────────┘

Auth__Edge__SharedSecret is not needed until the Profile A cutover. Then set Auth__DeploymentProfile=SameSite, clear the CORS origins, and set a random shared secret. Because the edge has to send the header, don't cut over until staging confirms that.

Static Web App (UI)

The API_BASE_URL GitHub secret should be https://rclimit-c8ancwfverfdc6ha.indiasouthcentral-01.azurewebsites.net. Changing it needs a UI redeploy, since the value is baked into config.json at build time.

Order of operations

1. Make the config changes above and rotate the database password and JWT secret.
2. Set the App Service variables.
3. Run migrations 024 and 025 against the production database. The runner also applies the seed, so run only the migration files there.
4. Deploy the API, then the UI.
5. Sign in on the production Static Web App. Existing sessions end because the token format changed.