import { useState } from 'react';
import { FaStar, FaRegStar } from 'react-icons/fa';

type FeedbackWidgetProps = {
	isAdmin?: boolean;
	backendBaseUrl?: string;
	householdId?: string;
};

const ChatIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		className={className}
	>
		<path d="M7.5 8.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Zm0 3.75a.75.75 0 0 1 .75-.75h5.25a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1-.75-.75Z" />
		<path fillRule="evenodd" d="M2.25 12c0 4.556 4.154 8.25 9.25 8.25a10.3 10.3 0 0 0 3.539-.62l4.442 1.187a.75.75 0 0 0 .919-.918l-1.188-4.443A10.303 10.303 0 0 0 20.25 12c0-4.556-4.154-8.25-8.75-8.25S2.25 7.444 2.25 12Zm8.75-6.75c-4.168 0-7.25 3.069-7.25 6.75 0 3.682 3.082 6.75 7.25 6.75 1.102 0 2.157-.22 3.11-.62a.75.75 0 0 1 .545-.036l3.267.872-.873-3.267a.75.75 0 0 1 .035-.546c.402-.952.616-2.005.616-3.153 0-3.681-3.082-6.75-7.25-6.75Z" clipRule="evenodd" />
	</svg>
);

const Star = ({ filled, onClick }: { filled: boolean; onClick: () => void }) => (
	<button
		type="button"
		aria-label={filled ? 'rated' : 'rate'}
		onClick={onClick}
		className="focus:outline-none transition-transform hover:scale-110"
	>
		{filled ? (
			<FaStar className="w-5 h-5 text-yellow-400" />
		) : (
			<FaRegStar className="w-5 h-5 text-gray-300" />
		)}
	</button>
);

export default function FeedbackWidget({ isAdmin = false, backendBaseUrl, householdId }: FeedbackWidgetProps) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');
	const [location, setLocation] = useState('');
	const [message, setMessage] = useState('');
	const [rating, setRating] = useState<number>(0);
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const canSubmit = name.trim() && location.trim() && message.trim() && rating > 0;

	const reset = () => {
		setName('');
		setLocation('');
		setMessage('');
		setRating(0);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!canSubmit) {
			setError('Please complete all fields and choose a rating.');
			return;
		}
		setSubmitting(true);
		try {
			const payload = {
				name: name.trim(),
				location: location.trim(),
				message: message.trim(),
				rating,
				createdAt: new Date().toISOString(),
				householdId: householdId || (typeof window !== 'undefined' ? localStorage.getItem('pl_household_id') : undefined)
			};

			let posted = false;
			if (backendBaseUrl) {
				try {
					const res = await fetch(`${backendBaseUrl}/feedback`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});
					if (res.ok) {
						posted = true;
						try {
							const out = await res.json();
							setSuccess(out?.message || 'Feedback sent successfully');
						} catch {
							setSuccess('Feedback sent successfully');
						}
					}
				} catch {
					// ignore and fallback
				}
			}

			if (!posted) {
				// Fallback to local storage queue
				const key = 'pl_feedback_queue';
						const prev = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(key) || '[]') : [];
				prev.push(payload);
						try { localStorage.setItem(key, JSON.stringify(prev)); } catch { /* ignore */ }
			}

			if (!posted) {
				setSuccess('Feedback saved locally — will sync when online.');
			}
			reset();
			setTimeout(() => { setSuccess(null); setOpen(false); }, 1200);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to submit feedback');
		} finally {
			setSubmitting(false);
		}
	};

		// Hide for admin after hooks are declared
		if (isAdmin) return null;

		return (
		<div className="fixed bottom-6 right-6 z-50">
			{/* Floating Button */}
			<button
				aria-label="Open feedback"
				onClick={() => setOpen(v => !v)}
				className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center bg-darkgreen-500 hover:bg-darkgreen-600 text-white transition"
			>
				<ChatIcon className="w-7 h-7" />
			</button>

			{/* Panel */}
			{open && (
				<div className="absolute bottom-20 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
					<div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold text-gray-900">We value your feedback</h3>
							<p className="text-xs text-gray-500">Tell us how we can improve.</p>
						</div>
						<button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
					</div>

					<form onSubmit={handleSubmit} className="p-4 space-y-3 text-sm">
						<div>
							<label className="block text-gray-700 mb-1">Full name<span className="text-red-500">*</span></label>
							<input
								value={name}
								onChange={e => setName(e.target.value)}
								className="w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-darkgreen-500"
								placeholder="e.g. Jane Doe"
								required
							/>
						</div>
						<div>
							<label className="block text-gray-700 mb-1">Location<span className="text-red-500">*</span></label>
							<input
								value={location}
								onChange={e => setLocation(e.target.value)}
								className="w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-darkgreen-500"
								placeholder="e.g. Kigali, Rwanda"
								required
							/>
						</div>
						<div>
							<label className="block text-gray-700 mb-1">Message<span className="text-red-500">*</span></label>
							<textarea
								value={message}
								onChange={e => setMessage(e.target.value)}
								rows={4}
								className="w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-darkgreen-500 resize-none"
								placeholder="Share your experience..."
								required
							/>
						</div>

						<div>
							<label className="block text-gray-700 mb-1">Rating<span className="text-red-500">*</span></label>
							<div className="flex items-center gap-1">
								{[1,2,3,4,5].map(n => (
									<Star key={n} filled={rating >= n} onClick={() => setRating(n)} />
								))}
								<span className="ml-2 text-xs text-gray-500">{rating > 0 ? `${rating}/5` : 'Tap to rate'}</span>
							</div>
						</div>

						{error && <div className="text-xs text-red-600">{error}</div>}
						{success && <div className="text-xs text-emerald-600">{success}</div>}

						<button
							type="submit"
							disabled={!canSubmit || submitting}
							className={`w-full mt-1 inline-flex items-center justify-center px-4 py-2 rounded-md text-white font-medium ${canSubmit ? 'bg-darkgreen-500 hover:bg-darkgreen-600' : 'bg-gray-300 cursor-not-allowed'}`}
						>
							{submitting ? 'Sending…' : 'Send feedback'}
						</button>
					</form>
				</div>
			)}
		</div>
	);
}

