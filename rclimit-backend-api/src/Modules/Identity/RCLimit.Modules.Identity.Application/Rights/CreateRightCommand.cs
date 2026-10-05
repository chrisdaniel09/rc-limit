using MediatR;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Rights;

public record CreateRightCommand(
    string Code,
    string Module,
    string Name,
    string? Description) : IRequest<RightDto>;

public class CreateRightCommandHandler : IRequestHandler<CreateRightCommand, RightDto>
{
    private readonly IIdentityDbContext _db;

    public CreateRightCommandHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<RightDto> Handle(CreateRightCommand request, CancellationToken cancellationToken)
    {
        var right = new Right
        {
            RightId = Guid.NewGuid(),
            Code = request.Code,
            Module = request.Module,
            Name = request.Name,
            Description = request.Description,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Rights.Add(right);
        await _db.SaveChangesAsync(cancellationToken);

        return new RightDto(
            right.RightId,
            right.Code,
            right.Module,
            right.Name,
            right.Description,
            right.IsActive
        );
    }
}
