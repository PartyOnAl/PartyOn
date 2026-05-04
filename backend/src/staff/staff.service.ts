import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { getSupabaseClient } from '../supabase/supabase.client';

const INVITE_ROLES = ['hostess', 'security', 'staff_manager'] as const;
type InviteRole = (typeof INVITE_ROLES)[number];
const STAFF_STATUSES = ['pending', 'approved', 'rejected'] as const;
type StaffStatus = (typeof STAFF_STATUSES)[number];

export type StaffInviteDto = {
  fullName?: string;
  email?: string;
  role?: InviteRole;
  message?: string;
};

export type StaffInviteResult = {
  profile: StaffProfile;
  /** Present when a new staff user was created (temporary password for the manager to share). */
  temporaryPassword?: string;
};

export type StaffListResult = {
  staff: StaffProfile[];
};

export type StaffStatusDto = {
  status?: StaffStatus;
};

export type StaffProfile = {
  id: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  phone_number: string | null;
  role: string | null;
  club_id: string | null;
  created_at: string | null;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    name: parts[0] ?? '',
    surname: parts.slice(1).join(' ') || null,
  };
}

/** 8-char alphanumeric (no ambiguous 0/O, 1/l/I). */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function computedStaffRole(staffRole: string | null, status: string | null) {
  if (!staffRole) return null;
  if (status === 'pending') return `pending_${staffRole}`;
  if (status === 'rejected') return `rejected_${staffRole}`;
  return staffRole;
}

@Injectable()
export class StaffService {
  private async resolveManagerClubId(managerUserId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data: managerProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('club_id')
      .eq('id', managerUserId)
      .maybeSingle();

    if (profileErr) throw new Error(profileErr.message);
    const clubId = managerProfile?.club_id ?? null;
    if (!clubId) throw new NotFoundException('No club found for this manager.');
    return clubId;
  }

  async getStaff(managerUserId: string): Promise<StaffListResult> {
    const supabase = getSupabaseClient();
    const clubId = await this.resolveManagerClubId(managerUserId);

    const staffUsers: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
      created_at?: string;
    }[] = [];
    let page = 1;
    const perPage = 100;

    while (page <= 10) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      staffUsers.push(
        ...data.users.filter((user) => {
          const metadata = user.user_metadata ?? {};
          return metadata.club_id === clubId && typeof metadata.staff_role === 'string';
        }),
      );
      if (data.users.length < perPage) break;
      page += 1;
    }

    if (staffUsers.length === 0) return { staff: [] };

    const ids = staffUsers.map((user) => user.id);
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, name, surname, email, phone_number, role, club_id, created_at')
      .in('id', ids);

    if (profilesErr) throw new Error(profilesErr.message);
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return {
      staff: staffUsers.map((user) => {
        const metadata = user.user_metadata ?? {};
        const profile = profileById.get(user.id);
        const staffRole = String(metadata.staff_role ?? '');
        const storedStatus = String(metadata.staff_status ?? 'approved');
        const staffStatus = storedStatus === 'rejected' ? 'rejected' : 'approved';
        const metadataName = String(metadata.name ?? '') || null;
        const metadataSurname = String(metadata.surname ?? '') || null;
        return {
          id: user.id,
          name: profile?.name ?? metadataName,
          surname: profile?.surname ?? metadataSurname,
          email: profile?.email ?? user.email ?? null,
          phone_number: profile?.phone_number ?? null,
          role: computedStaffRole(staffRole, staffStatus),
          club_id: profile?.club_id ?? clubId,
          created_at: profile?.created_at ?? user.created_at ?? null,
        };
      }),
    };
  }

  async inviteStaff(managerUserId: string, dto: StaffInviteDto): Promise<StaffInviteResult> {
    const fullName = dto.fullName?.trim() ?? '';
    const email = dto.email?.trim().toLowerCase() ?? '';
    const role = dto.role;

    if (!fullName) throw new BadRequestException('Full name is required.');
    if (!email || !email.includes('@')) throw new BadRequestException('A valid email is required.');
    if (!role || !INVITE_ROLES.includes(role)) {
      throw new BadRequestException('A valid staff role is required.');
    }

    const supabase = getSupabaseClient();
    const clubId = await this.resolveManagerClubId(managerUserId);
    const { name, surname } = splitName(fullName);
    const temporaryPassword = generateTemporaryPassword();

    const userMetadata = {
      name,
      surname,
      role: 'user',
      staff_role: role,
      staff_status: 'approved',
      club_id: clubId,
      must_change_password: true,
      ...(dto.message?.trim() ? { invite_message: dto.message.trim() } : {}),
    };

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createErr) {
      throw new BadRequestException(createErr.message);
    }

    const newUserId = created.user?.id;
    if (!newUserId) {
      throw new BadRequestException('Supabase did not return a user id after createUser.');
    }

    const profilePayload = {
      id: newUserId,
      name,
      surname,
      email,
      role: 'user',
      club_id: clubId,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: upsertErr } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('id, name, surname, email, phone_number, role, club_id, created_at')
      .single();

    if (upsertErr) {
      await supabase.auth.admin.deleteUser(newUserId);
      throw new Error(upsertErr.message);
    }

    return {
      profile: { ...profile, role: computedStaffRole(role, 'approved') },
      temporaryPassword,
    };
  }

  async updateStaffStatus(
    managerUserId: string,
    staffUserId: string,
    dto: StaffStatusDto,
  ): Promise<StaffInviteResult> {
    const status = dto.status;
    if (!status || !STAFF_STATUSES.includes(status)) {
      throw new BadRequestException('A valid staff status is required.');
    }

    const supabase = getSupabaseClient();
    const clubId = await this.resolveManagerClubId(managerUserId);
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(staffUserId);
    if (userErr) throw new Error(userErr.message);

    const metadata = userData.user.user_metadata ?? {};
    if (metadata.club_id !== clubId || typeof metadata.staff_role !== 'string') {
      throw new NotFoundException('Staff member not found for this club.');
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(staffUserId, {
      user_metadata: {
        ...metadata,
        staff_status: status,
      },
    });
    if (updateErr) throw new Error(updateErr.message);

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, name, surname, email, phone_number, role, club_id, created_at')
      .eq('id', staffUserId)
      .single();

    if (profileErr) throw new Error(profileErr.message);
    return {
      profile: {
        ...profile,
        role: computedStaffRole(String(metadata.staff_role), status),
      },
    };
  }

  async deleteStaff(
    managerUserId: string,
    staffUserId: string,
  ): Promise<{ success: true }> {
    const supabase = getSupabaseClient();
    const clubId = await this.resolveManagerClubId(managerUserId);
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(staffUserId);
    if (userErr) throw new Error(userErr.message);

    const metadata = userData.user.user_metadata ?? {};
    if (metadata.club_id !== clubId || typeof metadata.staff_role !== 'string') {
      throw new NotFoundException('Staff request not found for this club.');
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', staffUserId)
      .eq('club_id', clubId);

    if (profileErr) throw new Error(profileErr.message);

    const { error: authErr } = await supabase.auth.admin.deleteUser(staffUserId);
    if (authErr) throw new Error(authErr.message);

    return { success: true };
  }
}
