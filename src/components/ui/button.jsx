
export function Button({ children, ...props }) {
  return (
    <button
      className="rounded-xl bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      {...props}
    >
      {children}
    </button>
  );
}
