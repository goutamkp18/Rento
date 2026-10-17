# Antigravity Prompt — Dynamic StaySure AI PG Booking Receipt / PDF Invoice

Implement a dynamic, downloadable booking payment receipt in the existing StaySure AI project. Use `StaySure_Booking_Payment_Receipt_Template.html` as the visual and structural reference and `StaySure_Booking_Payment_Receipt_Template.docx` as a human-readable editable reference. Do not copy placeholder strings into a static image or hardcode one PG's details.

## Core requirement
Create a reusable receipt generator that produces a PDF for any PG property. All property-specific values must come from the verified booking/property/payment data, so the same template works for different PG names, addresses, owners, rooms, students, amounts, and transaction references.

## Data mapping
Map the template fields to the existing schema (inspect/reuse current names; do not blindly create duplicate tables):
- `platform_name`: platform branding, default `StaySure AI`
- `receipt_number`: unique server-generated receipt number
- `pg_name`: property name snapshotted on the booking at booking time, so future property edits do not silently change an old receipt
- `pg_address`: property's address, if available
- `pg_manager_name`: property manager/owner display name, if configured
- `pg_contact`: manager's configured contact details, if configured and appropriate to disclose
- `receipt_date`: receipt generation date/time in the agreed timezone
- `booking_id`: unique booking reference
- `booking_date`: booking creation/confirmation date from the persisted booking record
- `check_in_date`: planned check-in date, if the product captures it
- `booking_status`: actual persisted booking status; use `CONFIRMED` only after booking confirmation
- `room_or_bed`: selected room/bed, if the product supports it
- `student_name`, `student_phone`, `student_email`: authenticated student's booking details
- `pg_city_or_location`: property location, if available
- `booking_fee_inr`: verified booking fee formatted in INR
- `total_paid_inr`: total amount actually verified as paid in this transaction; normally equals the booking fee unless verified extra items exist
- `payment_gateway`: gateway/provider name
- `payment_reference`: provider transaction/payment ID or reference
- `payment_datetime`: verified payment date/time
- `verified_payment_status`: only use a paid/complete status after server-side verification
- `payment_status`: visible status chip; never show PAID while the payment is pending/failed
- `support_contact`: configured platform/owner support channel, otherwise omit or display a neutral fallback

Do not print literal `{{placeholder}}` tokens in a production receipt. If a field is not configured, omit its row or show a safe value such as `Not provided` where appropriate. In particular, omit the check-in date row if no check-in date was selected. Never invent owner contact details, addresses, transaction IDs, tax numbers, or payment amounts.

## Payment and booking rules
1. The student selects Reserve Bed and proceeds to the configured payment gateway.
2. Create the payment order server-side, using an authoritative booking fee from property configuration.
3. Treat browser/client payment success only as a signal to verify; do not trust it as proof of payment.
4. Verify gateway payment/signature server-side and make the booking/receipt flow idempotent.
5. Only after verified payment and confirmed booking, generate the final receipt and enable the PDF download.
6. A failed, abandoned, or pending payment must not produce a PAID receipt or confirmed booking.
7. The booking payment is separate from monthly rent. Display the exact message: `Monthly rent has to be paid later.` Monthly rent must not be included in the booking payment total unless the payment product is deliberately changed and clearly explained.
8. Never store payment card numbers or CVV. Keep gateway secrets server-side.
9. Authorize all booking and invoice requests so a student can only access their own booking receipt, while authorized administrators can access according to their existing role permissions.

## PDF generation
- Generate a real downloadable PDF from the receipt template using a PDF renderer compatible with the existing stack (inspect dependencies first; use the project's existing approach if suitable).
- Preserve the HTML/CSS layout, page size, text selection/readability, and background colors in print output.
- Use a useful filename such as `StaySure_Booking_Receipt_<booking-reference>.pdf` (sanitize the reference for filenames).
- Store the generated PDF privately if the app needs later downloads, or regenerate on authenticated request from the immutable booking/payment snapshot.
- Prevent a receipt generated for one student or property from being reused with another booking's data.
- Do not call a booking payment receipt a GST/tax invoice unless the business' lawful invoice requirements and verified tax metadata have been configured. Do not invent GST registration values or taxes.

## Invoice content and design
Follow the supplied HTML and DOCX templates:
- StaySure AI or configured platform name
- `BOOKING PAYMENT RECEIPT`
- Receipt number and date
- PG property name/address/manager (only populated from real configured data)
- Student name, phone and email
- Booking reference and room/bed details when applicable
- Booking fee line item and `TOTAL PAID NOW`
- Payment provider, transaction reference, payment date and verified status
- Prominent notice: `Monthly rent has to be paid later. This receipt records only the booking fee shown above. Monthly rent is not included in this payment and must be paid separately under the PG's agreed payment terms.`
- Support contact only when configured
- Footer clarifying that this is a booking payment receipt, not a monthly rent receipt or tax invoice unless separately configured and legally applicable

Keep the design professional and branded: midnight navy, purple accents, muted peach highlight, clean spacing and readable typography. Support long PG names, long addresses, missing optional data, narrow mobile screens, and safe text escaping. Do not break layout if a field is longer than normal.

## Student experience
After a verified payment and confirmed booking, show a success dialog with:
- `Congratulations on Your Booking!`
- Actual PG/property name
- Booking reference
- Verified booking fee paid
- Status: `PAID` / `CONFIRMED`
- Exact notice: `Monthly rent has to be paid later.`
- `Download PDF Invoice` button
- `View Booking Details` and `Close` actions

Add the same receipt download option to the student's existing My Bookings/booking history screen. Preserve current features and theme. Do not change Schedule Visit or Ask Question behavior.

## Tests / acceptance criteria
- Different PGs produce PDFs with their own correct names, addresses, configured booking fee and support details.
- Student/property/payment identifiers in the PDF match the same persisted booking.
- Receipt uses actual server-verified paid amount and payment reference.
- Pending, failed, cancelled or unverified payments never produce PAID receipts.
- Duplicate payment callbacks do not create duplicate confirmed bookings or receipt records.
- Long property names and missing optional property fields render without overflow or placeholder leakage.
- A student cannot download another student's receipt.
- The PDF opens correctly and its text is legible and selectable where the renderer allows.
- Existing project lint/build/tests pass.

Before implementing, inspect the current codebase and identify the frontend, backend, database, authentication, payment gateway and PDF-generation approach. Integrate with the existing architecture rather than replacing it. At completion, report files changed, configuration needed, tests run and any limitations. Do not claim that live payments work without valid gateway credentials and a verified test.
