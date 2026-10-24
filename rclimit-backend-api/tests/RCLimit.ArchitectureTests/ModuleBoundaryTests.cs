using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace RCLimit.ArchitectureTests;

// Reads the project files directly, so the rules hold for the real reference graph without loading assemblies.
// Each module must be separable into its own service later: other modules may depend on it only through Contracts.
public class ModuleBoundaryTests
{
    private static readonly string RepoRoot = FindRepoRoot();
    private static readonly string SourceRoot = Path.Combine(RepoRoot, "src");
    private static readonly string ModulesRoot = Path.Combine(SourceRoot, "Modules");

    [Fact]
    public void Modules_reference_other_modules_only_through_their_Contracts_project()
    {
        var violations = new List<string>();

        foreach (var project in AllProjects())
        {
            var owner = ModuleOf(project);
            if (owner is null)
                continue;

            foreach (var reference in ProjectReferences(project))
            {
                var target = ModuleOf(reference);
                if (target is null || target == owner)
                    continue;

                if (!Path.GetFileName(reference).EndsWith(".Contracts.csproj", StringComparison.Ordinal))
                    violations.Add($"{Name(project)} -> {Name(reference)}");
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void Domain_and_Contracts_projects_do_not_depend_on_EF_Core_or_Npgsql()
    {
        var violations = new List<string>();

        foreach (var project in AllProjects().Where(p => IsNamed(p, ".Domain.csproj") || IsNamed(p, ".Contracts.csproj")))
        {
            foreach (var package in PackageReferences(project))
            {
                if (package.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal)
                    || package.StartsWith("Npgsql", StringComparison.Ordinal))
                {
                    violations.Add($"{Name(project)} -> {package}");
                }
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void Application_projects_do_not_reference_any_Infrastructure_project()
    {
        var violations = new List<string>();

        foreach (var project in AllProjects().Where(p => IsNamed(p, ".Application.csproj")))
        {
            foreach (var reference in ProjectReferences(project))
            {
                if (IsNamed(reference, ".Infrastructure.csproj"))
                    violations.Add($"{Name(project)} -> {Name(reference)}");
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void Module_Infrastructure_projects_are_referenced_only_by_the_WebApi_host()
    {
        var violations = new List<string>();

        foreach (var project in AllProjects())
        {
            if (Name(project).Contains(".WebApi", StringComparison.Ordinal))
                continue;

            foreach (var reference in ProjectReferences(project))
            {
                if (ModuleOf(reference) is not null && IsNamed(reference, ".Infrastructure.csproj") && ModuleOf(project) != ModuleOf(reference))
                    violations.Add($"{Name(project)} -> {Name(reference)}");
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void Contracts_projects_depend_only_on_BuildingBlocks_Contracts()
    {
        var violations = new List<string>();

        foreach (var project in AllProjects().Where(p => IsNamed(p, ".Contracts.csproj") && ModuleOf(p) is not null))
        {
            foreach (var reference in ProjectReferences(project))
            {
                if (!Name(reference).Equals("RCLimit.BuildingBlocks.Contracts", StringComparison.Ordinal))
                    violations.Add($"{Name(project)} -> {Name(reference)}");
            }
        }

        Assert.Empty(violations);
    }

    // Source-level check: a module's code may name another module's namespace only through its Contracts namespace.
    // Catches a using or fully qualified type that a project reference alone would not show.
    [Fact]
    public void Module_source_uses_other_modules_only_through_their_Contracts_namespace()
    {
        var pattern = new Regex(@"RCLimit\.Modules\.(?<module>[A-Za-z]+)\.(?<part>[A-Za-z]+)", RegexOptions.Compiled);
        var violations = new List<string>();

        foreach (var file in Directory.EnumerateFiles(ModulesRoot, "*.cs", SearchOption.AllDirectories)
                     .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                              && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")))
        {
            var owner = ModuleOf(file);
            if (owner is null)
                continue;

            foreach (Match match in pattern.Matches(File.ReadAllText(file)))
            {
                var target = match.Groups["module"].Value;
                var part = match.Groups["part"].Value;

                if (target == owner || part == "Contracts")
                    continue;

                violations.Add($"{Path.GetRelativePath(RepoRoot, file)} -> RCLimit.Modules.{target}.{part}");
            }
        }

        Assert.Empty(violations);
    }

    private static IEnumerable<string> AllProjects() =>
        Directory.EnumerateFiles(SourceRoot, "*.csproj", SearchOption.AllDirectories);

    private static IEnumerable<string> ProjectReferences(string project)
    {
        var directory = Path.GetDirectoryName(project)!;
        return XDocument.Load(project)
            .Descendants("ProjectReference")
            .Select(e => Path.GetFullPath(Path.Combine(directory, e.Attribute("Include")!.Value)));
    }

    private static IEnumerable<string> PackageReferences(string project) =>
        XDocument.Load(project)
            .Descendants("PackageReference")
            .Select(e => e.Attribute("Include")!.Value);

    // "Accounting", "Identity", ... for a project under src/Modules; null for BuildingBlocks and the WebApi host.
    private static string? ModuleOf(string project)
    {
        var relative = Path.GetRelativePath(ModulesRoot, project);
        if (relative.StartsWith("..", StringComparison.Ordinal))
            return null;

        return relative.Split(Path.DirectorySeparatorChar)[0];
    }

    private static bool IsNamed(string project, string suffix) =>
        Path.GetFileName(project).EndsWith(suffix, StringComparison.Ordinal);

    private static string Name(string project) => Path.GetFileNameWithoutExtension(project);

    private static string FindRepoRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "RCLimit.slnx")))
            directory = directory.Parent;

        return directory?.FullName ?? throw new InvalidOperationException("RCLimit.slnx not found above the test output folder.");
    }
}
