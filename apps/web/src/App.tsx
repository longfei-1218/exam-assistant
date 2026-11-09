import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 h-12 w-12 rounded-lg bg-brand text-xl font-semibold text-white grid place-items-center">
          备
        </div>
        <h1 className="text-lg font-semibold text-slate-900">备考助手</h1>
        <p className="mt-1 text-sm text-slate-500">
          把一整段杂乱文本，变成能练的题。
        </p>
        <Link
          to="/health"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white"
        >
          开始
        </Link>
      </section>
    </main>
  );
}

function Health() {
  return (
    <main className="p-8">
      <Link to="/" className="text-sm text-brand">
        返回
      </Link>
      <h1 className="mt-4 text-lg font-semibold">API 状态</h1>
    </main>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/health" element={<Health />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
