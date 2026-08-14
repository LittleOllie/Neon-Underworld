-- One pending join request per (cartel, applicant). Historical ACCEPTED/DECLINED/CANCELLED rows are preserved.
CREATE UNIQUE INDEX "CartelJoinRequest_cartelId_applicantId_pending_key"
ON "CartelJoinRequest"("cartelId", "applicantId")
WHERE "status" = 'PENDING';
