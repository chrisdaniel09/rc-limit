using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Queries;

public record GetCurrentUserQuery(Guid UserId) : IQuery<UserDto>;

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, UserDto>
{
    private readonly IIdentityDbContext _db;

    public GetCurrentUserQueryHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<UserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.UserId == request.UserId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        return new UserDto(user.UserId, user.TenantId, user.Email, user.FullName);
    }
}
