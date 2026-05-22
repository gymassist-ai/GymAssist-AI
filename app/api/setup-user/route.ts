import { NextResponse } from 'next/server';
import { resolveActiveRequestOwner, resolveGymMemberTable, resolveGymPaymentTable } from '@/lib/gymMemberTables';

export async function POST(request: Request) {
  const resolved = await resolveActiveRequestOwner(request);
  if (resolved.error) return resolved.error;

  try {
    const tableName = await resolveGymMemberTable(resolved.owner!.userId);
    const paymentsTableName = await resolveGymPaymentTable(resolved.owner!.userId);
    return NextResponse.json({ success: true, tableName, paymentsTableName });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
