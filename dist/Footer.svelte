<script>
	import towLogo from '../../demo-app/src/lib/assets/Tow Center Logo.png';
</script>

<div id="footer">
	<div id="footer-inner">
		<div class="footer-content">
			<div class="footer-logo">
				<img src={towLogo} alt="Tow Center for Digital Journalism" />
			</div>
			<div class="footer-text">
				<h3>ABOUT THE TOW CENTER</h3>
				<p>The Tow Center for Digital Journalism at Columbia's Graduate School of Journalism, a partner of CJR, is a research center exploring the ways in which technology is changing journalism, its practice and its consumption — as we seek new ways to judge the reliability, standards, and credibility of information online.</p>
				<div class="footer-links">
					<a href="https://www.cjr.org/tow-center">View other Tow articles »</a>
					<a href="https://towcenter.columbia.edu/">Visit Tow Center website »</a>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	#footer {
		background-color: #f5f5f5;
		padding: 3rem 0;
		border-top: 1px solid #e0e0e0;
	}

	#footer-inner {
		max-width: 800px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	.footer-content {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 3rem;
	}

	.footer-logo {
		flex-shrink: 0;
	}

	.footer-logo img {
		max-width: 150px;
		height: auto;
	}

	.footer-text {
		flex: 1;
	}

	.footer-text h3 {
		font-family: "Graphik Web", 'Helvetica', sans-serif;
		font-weight: 700;
		font-size: 14px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #254c6f;
		margin: 0 0 0.75rem 0;
	}

	.footer-text p {
		font-family: "Graphik Web", 'Helvetica', sans-serif;
		font-size: 13px;
		line-height: 1.5;
		color: #254c6f;
		margin: 0 0 1rem 0;
	}

	.footer-links {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.footer-links a {
		font-family: "Graphik Web", 'Helvetica', sans-serif;
		font-weight: 700;
		font-size: 12px;
		letter-spacing: 0.05em;
		text-transform: none;
		color: #254c6f;
		text-decoration: none;
	}

	.footer-links a:hover {
		text-decoration: underline;
	}

	@media screen and (max-width: 768px) {
		#footer-inner {
			padding: 0 1rem;
		}

		.footer-content {
			flex-direction: column;
			gap: 2rem;
		}

		.footer-logo {
			text-align: center;
		}

		.footer-logo img {
			max-width: 150px;
		}

		.footer-text h3 {
			font-size: 16px;
		}

		.footer-text p {
			font-size: 14px;
		}

		.footer-links a {
			font-size: 12px;
		}
	}
</style>