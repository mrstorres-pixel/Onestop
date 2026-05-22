drop trigger if exists create_profile_after_signup on auth.users;
drop function if exists create_profile_for_new_user();

alter table profiles add column if not exists username text unique;

drop policy if exists "Users can read profiles" on profiles;
create policy "Users can read profiles" on profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
