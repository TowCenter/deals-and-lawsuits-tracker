<script>
	let { children, hed, subhed, date, byline1, byline1_url, byline2, byline2_url, brand, latestDate } = $props();

</script>

    <div class="container-lg title-image-lg">
        {#if children}
            {@render children()}
        {/if}

        <header class="col-sm-10">
            {#if brand}
                <div class="brand-title">{brand}</div>
            {/if}
            <h1 class="main-title">{hed}</h1>

            {#if subhed}
            <span class="post-excerpt"
                ><p>
                    {subhed}
                </p>
            </span>
            {/if}

            {#if byline1 || byline2}
            <div class="meta">
                <span class="byline" id="byline"
                    ><em>By</em>
                    {#if byline1}
                        {#if byline1_url}
                        <a href={byline1_url}>{byline1}</a>
                        {:else}
                        {byline1}
                        {/if}
                    {/if}
                    {#if byline1 && byline2} and {/if}
                    {#if byline2}
                        {#if byline2_url}
                        <a href={byline2_url}>{byline2}</a>
                        {:else}
                        {byline2}
                        {/if}
                    {/if}
                    </span
                >
            </div>
            {:else if latestDate}
            <div class="meta">
                <div class="update-date">
                    <em>Last updated on</em> <strong>{latestDate}</strong>
                </div>
            </div>
            {/if}
        </header>
    </div>

<style>
	.meta .update-date {
		font-family: "Lyon Text Web", 'Georgia', serif;
		font-size: 20px;
		line-height: 28px;
		font-weight: normal;
		color: #222222;
		text-transform: none;
		display: block;
		margin-top: 0;
		margin-left: 0;
		letter-spacing: 0;
	}

	.meta .update-date em {
		font-style: italic;
	}

	.meta .update-date strong {
		font-weight: bold;
	}

	@media screen and (max-width: 768px) {
		.meta .update-date {
			font-size: 18px;
			line-height: 1.6;
		}
	}
</style>
