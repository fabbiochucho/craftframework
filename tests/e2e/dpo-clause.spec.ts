import { test, expect } from '@playwright/test'

// The DPO clause must appear verbatim on the privacy policy (text as supplied by the DPO, 15 Oct 2026).
const VERBATIM = [
  'Data Protection Officer (DPO) Appointment & Contact',
  'In compliance with the Nigeria Data Protection Act (NDPA), the Di Badili Leadership Sustainability Initiative (trading as DiBadili Institute, also known as Become Change Institute) has appointed a designated Data Protection Officer to oversee our data privacy strategy, monitor compliance across all our platforms (including becomechange.institute, anda.becomechange.institute, neurafiki.becomechange.institute, craftframework.becomechange.institute, devmapper.africa, and abiolaoshunniyi.lovable.app), and serve as the primary point of contact for data subjects and regulatory authorities.',
  'If you have any questions about this Privacy Policy, wish to exercise your data privacy rights (such as data access, correction, restriction, or deletion), or have a complaint regarding how we handle your personal information, please contact our DPO directly:',
  'Name of DPO: Abiola Oshunniyi',
  'Designation: Data Protection Officer (DPO)',
  'Mailing Address: P.O. Box 2550, Festac Town, Lagos, Nigeria.',
  'Official Contact Email: dpo@becomechange.institute',
  'Contact Phone Number: +2348188466444',
  'Our DPO will review and respond to all valid requests, inquiries, or grievances within the statutory timelines provided under Nigerian data protection laws.',
]

test('privacy policy contains the DPO clause verbatim', async ({ page }) => {
  await page.goto('/privacy')
  const text = (await page.locator('#dpo').innerText()).replace(/\s+/g, ' ')
  for (const line of VERBATIM) expect(text).toContain(line)
  await expect(page.locator('#dpo').getByRole('link', { name: 'dpo@becomechange.institute' })).toHaveAttribute('href', 'mailto:dpo@becomechange.institute')
})
