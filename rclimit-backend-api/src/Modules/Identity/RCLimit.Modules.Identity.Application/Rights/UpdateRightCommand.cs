using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Rights;

public record UpdateRightCommand(
    Guid RightId,
    string Name,
    string? Description,
    bool IsActive) : IRequest<RightDto>;

public class UpdateRightCommandHandler : IRequestHandler<UpdateRightCommand, RightDto>
{
    private readonly IIdentityDbContext _db;

    public UpdateRightCommandHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<RightDto> Handle(UpdateRightCommand request, CancellationToken cancellationToken)
    {
        var right = await _db.Rights
            .FirstOrDefaultAsync(r => r.RightId == request.RightId, cancellationToken);

        if (right == null)
            throw new InvalidOperationException($"Right {request.RightId} not found.");

        right.Name = request.Name;
        right.Description = request.Description;
        right.IsActive = request.IsActive;

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
