import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
}

if (!supabaseAdminKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const roleNameToId = {
  admin: 1,
  customer: 2,
  rider: 3,
  cashier: 4,
};

const seedUsers = [
  {
    email: 'customer@bloom.shop',
    password: 'Password123!',
    role: 'customer',
    full_name: 'Elena Cruz',
    phone: '+63 917 555 0199',
    address: '12 Sampaguita St, Makati City',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    points: 742,
    is_active: true,
  },
  {
    email: 'admin@bloom.shop',
    password: 'Password123!',
    role: 'admin',
    full_name: 'Andrea Flores',
    phone: '+63 917 555 0101',
    address: 'Bloom HQ, BGC, Taguig',
    avatar_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=200&q=80',
    points: 0,
    is_active: true,
  },
  {
    email: 'rider@bloom.shop',
    password: 'Password123!',
    role: 'rider',
    full_name: 'Paolo Ramos',
    phone: '+63 917 555 0102',
    address: 'Pasig Dispatch Hub',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    points: 0,
    is_active: true,
  },
  {
    email: 'cashier@bloom.shop',
    password: 'Password123!',
    role: 'cashier',
    full_name: 'Sofia Lim',
    phone: '+63 917 555 0103',
    address: 'Bloom Shop Flagship',
    avatar_url: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=200&q=80',
    points: 0,
    is_active: true,
  },
];

async function main() {
  const { data: existingUsersData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Unable to list auth users: ${listError.message}`);
  }

  const existingUsers = existingUsersData.users ?? [];

  for (const seedUser of seedUsers) {
    const existing = existingUsers.find((entry) => entry.email?.toLowerCase() === seedUser.email.toLowerCase());

    const authPayload = {
      email: seedUser.email,
      password: seedUser.password,
      email_confirm: true,
      user_metadata: {
        role: seedUser.role,
        full_name: seedUser.full_name,
        phone: seedUser.phone,
        address: seedUser.address,
        avatar_url: seedUser.avatar_url,
      },
    };

    let authUserId;

    if (existing) {
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, authPayload);

      if (error) {
        throw new Error(`Unable to update auth user ${seedUser.email}: ${error.message}`);
      }

      authUserId = data.user.id;
      console.log(`Updated auth user ${seedUser.email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser(authPayload);

      if (error) {
        throw new Error(`Unable to create auth user ${seedUser.email}: ${error.message}`);
      }

      authUserId = data.user.id;
      console.log(`Created auth user ${seedUser.email}`);
    }

    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: authUserId,
        role_id: roleNameToId[seedUser.role],
        full_name: seedUser.full_name,
        phone: seedUser.phone,
        address: seedUser.address,
        avatar_url: seedUser.avatar_url,
        points: seedUser.points,
        is_active: seedUser.is_active,
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      throw new Error(`Unable to upsert profile for ${seedUser.email}: ${profileError.message}`);
    }

    console.log(`Upserted profile for ${seedUser.email}`);
  }

  console.log('Seeded actual Supabase users successfully.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
