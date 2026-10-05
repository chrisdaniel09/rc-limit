using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Persistence.Configurations;

public class RoleRightConfiguration : IEntityTypeConfiguration<RoleRight>
{
    public void Configure(EntityTypeBuilder<RoleRight> builder)
    {
        builder.ToTable("role_rights");
        builder.HasKey(rr => new { rr.RoleId, rr.RightId });

        builder.Property(rr => rr.RoleId).HasColumnName("role_id");
        builder.Property(rr => rr.RightId).HasColumnName("right_id");
    }
}
