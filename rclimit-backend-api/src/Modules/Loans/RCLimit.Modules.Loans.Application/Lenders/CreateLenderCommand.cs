using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Lenders;

public record CreateLenderCommand(
    string Name,
    string Code,
    decimal BaseInterestRate,
    int DefaultTenureLimitDays) : IRequest<Guid>;

public class CreateLenderCommandHandler : IRequestHandler<CreateLenderCommand, Guid>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateLenderCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(CreateLenderCommand request, CancellationToken cancellationToken)
    {
        var lender = new Lender
        {
            LenderId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Name = request.Name,
            Code = request.Code,
            BaseInterestRate = request.BaseInterestRate,
            DefaultTenureLimitDays = request.DefaultTenureLimitDays
        };

        _db.Lenders.Add(lender);
        await _db.SaveChangesAsync(cancellationToken);
        return lender.LenderId;
    }
}
