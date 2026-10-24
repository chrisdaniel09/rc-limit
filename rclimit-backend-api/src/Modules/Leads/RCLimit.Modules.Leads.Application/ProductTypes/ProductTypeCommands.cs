using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.ProductTypes;

public record GetProductTypesQuery : IRequest<List<ProductTypeDto>>;

public class GetProductTypesQueryHandler(ILeadsDbContext db, ITenantContext tenant)
    : IRequestHandler<GetProductTypesQuery, List<ProductTypeDto>>
{
    public async Task<List<ProductTypeDto>> Handle(GetProductTypesQuery request, CancellationToken cancellationToken)
    {
        var items = await db.ProductTypes
            .Where(p => p.TenantId == tenant.TenantId)
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Code)
            .ToListAsync(cancellationToken);

        return items.Select(ProductTypeDto.From).ToList();
    }
}

public record CreateProductTypeCommand(
    string Code,
    string Label,
    int SortOrder,
    List<ProductFieldDefinition> FieldSchema,
    List<ActionDefinition> Actions) : IRequest<ProductTypeDto>;

public class CreateProductTypeCommandHandler(ILeadsDbContext db, ITenantContext tenant, IActionRegistry actions)
    : IRequestHandler<CreateProductTypeCommand, ProductTypeDto>
{
    public async Task<ProductTypeDto> Handle(CreateProductTypeCommand request, CancellationToken cancellationToken)
    {
        var code = ProductTypeRules.NormalizeCode(request.Code);
        ProductTypeRules.Validate(request.FieldSchema, request.Actions, actions);

        var exists = await db.ProductTypes.AnyAsync(
            p => p.TenantId == tenant.TenantId && p.Code == code, cancellationToken);
        if (exists)
            throw new BusinessRuleException($"Product type '{code}' already exists.");

        var entity = new ProductType
        {
            ProductTypeId = Guid.NewGuid(),
            TenantId = tenant.TenantId,
            Code = code,
            Label = request.Label.Trim(),
            SortOrder = request.SortOrder,
            IsActive = true,
            FieldSchema = request.FieldSchema,
            Actions = request.Actions,
            CreatedAt = DateTime.UtcNow
        };

        db.ProductTypes.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        return ProductTypeDto.From(entity);
    }
}

// The code is not editable: leads store it, so renaming it would orphan them.
public record UpdateProductTypeCommand(
    Guid ProductTypeId,
    string Label,
    int SortOrder,
    bool IsActive,
    List<ProductFieldDefinition> FieldSchema,
    List<ActionDefinition> Actions) : IRequest<ProductTypeDto>;

public class UpdateProductTypeCommandHandler(ILeadsDbContext db, ITenantContext tenant, IActionRegistry actions)
    : IRequestHandler<UpdateProductTypeCommand, ProductTypeDto>
{
    public async Task<ProductTypeDto> Handle(UpdateProductTypeCommand request, CancellationToken cancellationToken)
    {
        var entity = await db.ProductTypes.FirstOrDefaultAsync(
            p => p.ProductTypeId == request.ProductTypeId && p.TenantId == tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("ProductType", request.ProductTypeId);

        ProductTypeRules.Validate(request.FieldSchema, request.Actions, actions);

        entity.Label = request.Label.Trim();
        entity.SortOrder = request.SortOrder;
        entity.IsActive = request.IsActive;
        entity.FieldSchema = request.FieldSchema;
        entity.Actions = request.Actions;

        await db.SaveChangesAsync(cancellationToken);

        return ProductTypeDto.From(entity);
    }
}
