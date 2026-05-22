alter table profiles add column if not exists username text unique;

update profiles
set username = lower(regexp_replace(full_name, '[^a-zA-Z0-9_]+', '', 'g'))
where username is null;

create or replace function create_profile_for_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute procedure create_profile_for_new_user();

drop policy if exists "Users can read profiles" on profiles;
create policy "Users can read profiles" on profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
