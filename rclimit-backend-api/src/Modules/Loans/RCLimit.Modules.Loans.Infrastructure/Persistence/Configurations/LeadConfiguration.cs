using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("leads");
        builder.HasKey(e => e.LeadId);
        builder.Property(e => e.LeadId).HasColumnName("lead_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.LeadSource).HasColumnName("lead_source").HasMaxLength(30);
        builder.Property(e => e.PartnerId).HasColumnName("partner_id");
        builder.Property(e => e.ReferredByUserId).HasColumnName("referred_by_user_id");
        builder.Property(e => e.WhatsappPhoneNumber).HasColumnName("whatsapp_phone_number").HasMaxLength(20);
        builder.Property(e => e.ContactPhone).HasColumnName("contact_phone").HasMaxLength(20);
        builder.Property(e => e.ApplicantName).HasColumnName("applicant_name").HasMaxLength(150);
        builder.Property(e => e.RequestedLoanAmount).HasColumnName("requested_loan_amount");
        builder.Property(e => e.VehicleRegistrationNumber).HasColumnName("vehicle_registration_number").HasMaxLength(20);
        builder.Property(e => e.VahanValidationStatus).HasColumnName("vahan_validation_status").HasMaxLength(30);
        builder.Property(e => e.CibilScorePreview).HasColumnName("cibil_score_preview");
        builder.Property(e => e.LeadStatus).HasColumnName("lead_status").HasMaxLength(30);
        builder.Property(e => e.Notes).HasColumnName("notes");
        builder.Property(e => e.AssignedToUserId).HasColumnName("assigned_to_user_id");
        builder.Property(e => e.AssignedAt).HasColumnName("assigned_at");
        builder.Property(e => e.CibilCheckStatus).HasColumnName("cibil_check_status").HasMaxLength(20);
        builder.Property(e => e.CibilCheckedAt).HasColumnName("cibil_checked_at");
        builder.Property(e => e.RcCheckStatus).HasColumnName("rc_check_status").HasMaxLength(20);
        builder.Property(e => e.RcCheckedAt).HasColumnName("rc_checked_at");
        builder.Property(e => e.ConvertedCustomerId).HasColumnName("converted_customer_id");
        builder.Property(e => e.ConvertedAt).HasColumnName("converted_at");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
    }
}
