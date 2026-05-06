<script>
	let isOpen = $state(false);
</script>

<div class="credits-toggle-section">
	<button class="credits-toggle-btn" onclick={() => isOpen = !isOpen}>
		<em>Credit and Acknowledgements</em> <span class="credits-toggle-icon">{isOpen ? '−' : '+'}</span>
	</button>
	{#if isOpen}
		<div class="credits-box">
			<div class="credits-inner">
				<div class="credits-item">
					<span class="credits-label">Compiled and Maintained By:</span>
					<a href="https://towcenter.columbia.edu/content/klaudia-jazwinska">Klaudia Jaźwińska</a>
				</div>
				<div class="credits-item">
					<span class="credits-label">Design and Development:</span>
					<a href="https://towcenter.columbia.edu/content/aisvarya-chandrasekar">Aisvarya Chandrasekar</a>
				</div>
				<div class="credits-acknowledgement">
					<span class="credits-label">Acknowledgements:</span>
					<p>Thanks to Dr. Pete Brown for <a href="https://petebrown.quarto.pub/pnp-ai-partnerships/">initiating</a> this database, <a href="https://restofworld.org/2024/elections-ai-tracker/">Rest of World's Election AI Tracker</a> for design inspiration, and Andrea Vega Yudico and Rob Saxon Threlkeld for their early data contributions.</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.credits-toggle-section {
		display: inline-block;
	}

	/* Override meta/byline styles with credit box styles */
	:global(.meta .credits-toggle-section) {
		font-family: "Lyon Text Web", 'Georgia', serif !important;
		font-size: 20px !important;
		font-weight: normal !important;
		text-transform: none !important;
		letter-spacing: 0 !important;
		color: #222222 !important;
		line-height: 28px !important;
		margin-bottom: 0 !important;
	}

	/* Override meta/byline link styles */
	:global(.meta .credits-toggle-section a),
	:global(.meta .credits-box a),
	:global(.meta .credits-inner a),
	:global(.meta .credits-item a),
	:global(.meta .credits-acknowledgement a) {
		font-family: "Graphik Web", 'Helvetica', sans-serif !important;
		font-size: 13px !important;
		font-weight: normal !important;
		text-transform: none !important;
		letter-spacing: 0 !important;
		color: #333 !important;
		text-decoration: underline !important;
		line-height: 1.8 !important;
	}

	:global(.meta .credits-toggle-section a:hover),
	:global(.meta .credits-box a:hover),
	:global(.meta .credits-inner a:hover),
	:global(.meta .credits-item a:hover),
	:global(.meta .credits-acknowledgement a:hover) {
		color: #254c6f !important;
	}

	.credits-toggle-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: "Lyon Text Web", 'Georgia', serif;
		font-size: 20px;
		line-height: 28px;
		font-weight: normal;
		color: #222222;
		text-transform: none;
		letter-spacing: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		transition: opacity 0.2s;
	}

	.credits-toggle-btn:hover {
		opacity: 0.7;
	}

	.credits-toggle-btn em {
		font-style: italic;
		font-weight: normal;
	}

	.credits-toggle-icon {
		font-size: 20px;
		font-weight: normal;
		line-height: 28px;
	}

	.credits-box {
		margin-top: 1.5rem;
		width: 100%;
	}

	.credits-inner {
		max-width: 600px;
		margin: 0 auto;
		padding: 1.5rem 2rem;
		border: 1px solid #e0e0e0;
		background-color: #fafafa;
	}

	.credits-item {
		font-family: "Graphik Web", 'Helvetica', sans-serif;
		font-size: 13px;
		line-height: 1.8;
		color: #333;
		margin: 0;
	}

	.credits-label {
		font-weight: 600;
		margin-right: 0.5rem;
	}

	.credits-item a {
		color: #333;
		text-decoration: underline;
	}

	.credits-item a:hover {
		color: #254c6f;
	}

	.credits-acknowledgement {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e0e0e0;
		font-family: "Graphik Web", 'Helvetica', sans-serif;
		font-size: 13px;
		line-height: 1.8;
		color: #333;
	}

	.credits-acknowledgement .credits-label {
		font-weight: 600;
		margin-right: 0.5rem;
	}

	.credits-acknowledgement p {
		line-height: 1.6;
		margin: 0;
		margin-top: 0.25rem;
	}

	.credits-acknowledgement a {
		color: #333;
		text-decoration: underline;
	}

	.credits-acknowledgement a:hover {
		color: #254c6f;
	}

	@media screen and (max-width: 768px) {
		.credits-toggle-section {
			padding-top: 2rem;
		}

		.credits-toggle-btn {
			font-size: 18px;
			line-height: 1.6;
		}

		.credits-toggle-icon {
			font-size: 18px;
			line-height: 1.6;
		}

		.credits-box {
			margin-top: 1rem;
		}

		.credits-inner {
			padding: 1rem;
			max-width: 100%;
		}

		.credits-item {
			font-size: 12px;
			line-height: 1.6;
			margin-bottom: 0.5rem;
		}

		.credits-label {
			display: block;
			margin-bottom: 0.25rem;
			margin-right: 0;
		}

		.credits-acknowledgement {
			margin-top: 1rem;
			padding-top: 1rem;
		}

		.credits-acknowledgement .credits-label {
			display: block;
			margin-bottom: 0.5rem;
		}

		.credits-acknowledgement {
			font-size: 12px;
			line-height: 1.6;
		}

		.credits-acknowledgement p {
			margin-top: 0;
			line-height: 1.6;
		}
	}
</style>

