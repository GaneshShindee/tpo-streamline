import { useQuery } from "@tanstack/react-query";
import { CompanyService } from "@/services/CompanyService";

export function useCompanyOffering(offeringId: number) {
  return useQuery({
    queryKey: ["company-offering-info-live-questions", offeringId],
    queryFn: () => CompanyService.getOffering(offeringId),
    enabled: Number.isFinite(offeringId) && offeringId > 0,
    staleTime: 0,
    retry: 1,
  });
}