import { slaService } from '@/modules/sla/services/sla.service';
import { handleApiError } from '@/shared/errors/errors';

export async function POST() {
  try {
    const count = await slaService.checkSlaBreaches();
    return Response.json({ success: true, breachedCount: count });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const count = await slaService.checkSlaBreaches();
    return Response.json({ success: true, breachedCount: count });
  } catch (error) {
    return handleApiError(error);
  }
}
