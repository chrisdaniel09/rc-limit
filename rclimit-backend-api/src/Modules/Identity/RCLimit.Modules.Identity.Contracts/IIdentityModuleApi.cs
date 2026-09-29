using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Contracts;

public interface IIdentityModuleApi
{
    Task<UserDto?> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> ValidateUserExistsAsync(Guid userId, CancellationToken cancellationToken = default);
}
