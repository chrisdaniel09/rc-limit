using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.ProductTypes;

public record ProductTypeDto(
    Guid ProductTypeId,
    string Code,
    string Label,
    int SortOrder,
    bool IsActive,
    List<ProductFieldDefinition> FieldSchema,
    List<ActionDefinition> Actions)
{
    public static ProductTypeDto From(ProductType entity) => new(
        entity.ProductTypeId,
        entity.Code,
        entity.Label,
        entity.SortOrder,
        entity.IsActive,
        entity.FieldSchema,
        entity.Actions);
}
