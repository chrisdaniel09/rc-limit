using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Domain.Validation;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Users;

public record CreateUserCommand(
    string Email,
    string FullName,
    string? PhoneNumber,
    string Password,
    List<Guid> RoleIds) : IRequest<UserDto>;

public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, UserDto>
{
    private readonly IIdentityDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantContext _tenant;

    public CreateUserCommandHandler(IIdentityDbContext db, IPasswordHasher passwordHasher, ITenantContext tenant)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _tenant = tenant;
    }

    public async Task<UserDto> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        PasswordPolicy.Validate(request.Password);
        var phoneNumber = IndianMobileNumber.ValidateOptional(request.PhoneNumber, "Phone number");

        var tenantId = _tenant.TenantId;
        var email = request.Email.Trim();

        var exists = await _db.Users
            .AnyAsync(u => u.Email == email && u.TenantId == tenantId, cancellationToken);
        if (exists)
            throw new BusinessRuleException("A user with this email already exists in this tenant.");

        var roleIds = request.RoleIds.Distinct().ToList();
        var validRoleCount = await _db.Roles
            .CountAsync(r => roleIds.Contains(r.RoleId) && r.IsActive, cancellationToken);
        if (validRoleCount != roleIds.Count)
            throw new BusinessRuleException("One or more selected roles do not exist or are inactive.");

        var (hash, salt) = _passwordHasher.HashPassword(request.Password);
        var user = User.Create(tenantId, email, request.FullName.Trim(), phoneNumber, hash, salt);
        _db.Users.Add(user);

        _db.UserRoles.AddRange(roleIds.Select(roleId => new UserRole
        {
            UserId = user.UserId,
            RoleId = roleId
        }));

        await _db.SaveChangesAsync(cancellationToken);

        return new UserDto(user.UserId, user.TenantId, user.Email, user.FullName);
    }
}
