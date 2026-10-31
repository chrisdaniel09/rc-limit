using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;

namespace RCLimit.BuildingBlocks.Infrastructure.Export;

/// <summary>
/// Builds a CSV download for list exports (docs/ui_ux_specification.md §15-6). UTF-8 with a BOM so Excel reads ₹ and
/// Indian names correctly. Cells that start with = + - @ are prefixed with ' so a spreadsheet never runs them as formulas.
/// </summary>
public static class CsvFile
{
    public static FileContentResult Create(string fileName, IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<object?>> rows)
    {
        var sb = new StringBuilder();
        AppendLine(sb, headers.Cast<object?>().ToList());
        foreach (var row in rows) AppendLine(sb, row);
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return new FileContentResult(bytes, "text/csv; charset=utf-8") { FileDownloadName = fileName };
    }

    private static void AppendLine(StringBuilder sb, IReadOnlyList<object?> cells)
    {
        for (var i = 0; i < cells.Count; i++)
        {
            if (i > 0) sb.Append(',');
            sb.Append(Escape(Format(cells[i])));
        }
        sb.Append("\r\n");
    }

    private static string Format(object? value) => value switch
    {
        null => "",
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime dt => dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
        decimal m => m.ToString("0.00", CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "",
    };

    private static string Escape(string value)
    {
        if (value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' && !decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _))
            value = "'" + value;
        return value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }
}
