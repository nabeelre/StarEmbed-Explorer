# StarEmbed Explorer (SEE)

A web UI for exploring large astronomical time-series datasets — light curves, sky positions, and metadata for hundreds of thousands of stars.

Reads datasets directly from the [HuggingFace Hub](https://huggingface.co/datasets) without downloading them: only the data needed for the current view is fetched. Also self-hosts against a local copy of the data.

## Try it

[See it live →](https://nabeelre.github.io/StarEmbed-Explorer/)

Point it at any compatible HF dataset via a URL parameter:

```
https://nabeelre.github.io/StarEmbed-Explorer/?dataset=user/name
```

## Run it locally

```bash
npm install
npm run dev
```
