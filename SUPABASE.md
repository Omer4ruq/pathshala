# Connecting Pathshala to Supabase

The demo keeps all data in the browser (`localStorage`), seeded from `src/lib/data.ts`.
Every read and write in the app goes through **one file**, `src/lib/store.tsx`, so moving to a real backend means changing that file and leaving the pages alone.

## 1. Create the project

1. Go to <https://supabase.com>, create a project, and choose the Singapore or Mumbai region (closest to Bangladesh).
2. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
3. In this folder:

```bash
npm i @supabase/supabase-js
```

Create `.env.local` (it's git-ignored by Vite's defaults; never commit keys):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
```

## 2. Create the tables

Open **SQL Editor** in Supabase and run:

```sql
-- Roles: every login gets a profile row that says what they may do.
create type user_role as enum ('super_admin', 'teacher', 'accountant', 'student');

create table students (
  id text primary key,
  name text not null,
  gender text,
  cls text not null,
  section text not null check (section in ('A','B')),
  shift text not null check (shift in ('Morning','Day')),
  roll int not null,
  guardian text, phone text, dob date, address text,
  admission_date date,
  monthly_fee numeric not null default 0,
  status text not null default 'active',
  unique (cls, section, shift, roll)
);

create table teachers (
  id text primary key,
  name text not null, gender text, email text unique, phone text,
  subject text, qualification text, join_date date,
  salary numeric not null default 0,
  status text not null default 'active'
);

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  name text not null,
  teacher_id text references teachers(id),
  student_id text references students(id)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references teachers(id) on delete cascade,
  cls text not null, section text not null, shift text not null, subject text not null,
  is_class_teacher boolean not null default false,
  unique (cls, section, shift, subject)
);

create table attendance (
  date date not null,
  student_id text not null references students(id) on delete cascade,
  mark char(1) not null check (mark in ('P','A','L')),
  primary key (date, student_id)
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('class_test','mid_term','final')),
  cls text not null, section text not null, shift text not null, subject text not null,
  date date not null,
  total_marks numeric not null
);

create table marks (
  exam_id uuid not null references exams(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  obtained numeric not null,
  primary key (exam_id, student_id)
);

create table fee_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  month text not null,            -- 'YYYY-MM'
  amount numeric not null,
  paid_amount numeric not null default 0,
  paid_on date, method text,
  unique (student_id, month)
);

-- One row per payment, so partial payments keep their own receipt number/date/method
-- (the demo only stores the running total on the invoice).
create table fee_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references fee_invoices(id) on delete cascade,
  amount numeric not null, method text not null, paid_on date not null default current_date,
  receipt_no text unique not null
);

create table salaries (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references teachers(id) on delete cascade,
  month text not null, amount numeric not null,
  paid boolean not null default false, paid_on date,
  unique (teacher_id, month)
);

create table expenses (id uuid primary key default gen_random_uuid(), date date not null, category text, note text, amount numeric not null);
create table notices  (id uuid primary key default gen_random_uuid(), date date not null default current_date, title text not null, body text, audience text not null default 'All');
create table books    (id uuid primary key default gen_random_uuid(), title text not null, subject text, cls text, pages int, file_path text);
```

## 3. Role-based access (Row Level Security)

The app already hides menus by role (`src/nav.ts`). On a real backend the **database** must enforce it too; otherwise anyone with the anon key could read everything.

```sql
create function my_role() returns user_role language sql stable security definer
as $$ select role from profiles where user_id = auth.uid() $$;

alter table students enable row level security;
alter table attendance enable row level security;
alter table marks enable row level security;
alter table fee_invoices enable row level security;
-- (enable on every table)

-- Admin can do everything
create policy admin_all on students for all using (my_role() = 'super_admin');

-- Teachers read students of the class groups they're assigned to
create policy teacher_read on students for select using (
  my_role() = 'teacher' and exists (
    select 1 from assignments a join profiles p on p.teacher_id = a.teacher_id
    where p.user_id = auth.uid() and a.cls = students.cls and a.section = students.section and a.shift = students.shift));

-- Students see only themselves
create policy student_self on students for select using (
  id = (select student_id from profiles where user_id = auth.uid()));

-- Accountant: fees + salaries + expenses
create policy accountant_fees on fee_invoices for all using (my_role() in ('accountant','super_admin'));
```

Write the same pattern for `attendance`, `exams` and `marks` (teacher = own groups, student = own rows) and for `salaries` and `expenses` (accountant and admin).

## 4. Logins

1. **Authentication → Providers**: enable Email (or phone OTP for guardians).
2. Create users under **Authentication → Users**, then insert a `profiles` row for each with the right `role` and `teacher_id` / `student_id`.
3. Replace the demo account picker in `src/pages/Login.tsx` with:

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
const { data: profile } = await supabase.from('profiles').select('*').single()
// map profile -> AppUser { id, name, role, title, refId: profile.teacher_id ?? profile.student_id }
```

## 5. Swap the store actions

In `src/lib/store.tsx`, load data on login instead of from `localStorage`, and make each action write to Supabase. For example:

```ts
async saveAttendance(date, marks) {
  const rows = Object.entries(marks).map(([student_id, mark]) => ({ date, student_id, mark }))
  const { error } = await supabase.from('attendance').upsert(rows)
  if (error) return toast(error.message, 'err')
  patch(d => ({ attendance: { ...d.attendance, [date]: { ...d.attendance[date], ...marks } } }))
},

upsertStudents(rows) {               // Excel bulk import
  return supabase.from('students').upsert(rows)   // id present = update, new id = insert
},
```

Column names are snake_case in SQL and camelCase in the app (`monthly_fee` ↔ `monthlyFee`). Map them in one helper when loading and saving.

The grading logic in `src/lib/grading.ts` is pure TypeScript. You can keep it in the browser, or move it into a Supabase Edge Function later when report generation should run on a schedule (for example, every Thursday's weekly report).

## 6. Files (books, PDFs)

**Storage → New bucket** `books` (private). Upload with `supabase.storage.from('books').upload(path, file)` and open with `createSignedUrl(path, 3600)`. Replace `openBookPdf` in `src/lib/export.ts`.

## 7. AI tutor

`askTutor()` at the top of `src/pages/Tutor.tsx` is the single integration point. Point it at a Supabase Edge Function that calls your LLM provider, so the API key stays on the server.
