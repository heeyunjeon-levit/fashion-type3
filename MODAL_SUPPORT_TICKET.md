# GroundingDINO on Modal - Need Setup Guidance

## Context
Previous ticket response: *"The GroundingDINO team calls out this specific issue on their github page. I think you need to follow their instructions really strictly."*

**We need help following GroundingDINO's strict requirements within Modal's environment.**

---

## Problem
Deploying [GroundingDINO](https://github.com/IDEA-Research/GroundingDINO) on Modal T4 GPU fails with:

```python
ImportError: name '_C' is not defined  # torchvision._C missing PyInit symbol
```

**Tested:**
- Python 3.10.17, 3.11
- PyTorch 2.3.1/2.4.1/2.5.1+cu121
- TorchVision 0.18.1/0.19.1/0.20.1+cu121
- Both Modal's official PyTorch setup and explicit wheel URLs

**GroundingDINO's official Dockerfile:**
```dockerfile
FROM pytorch/pytorch:2.1.2-cuda12.1-cudnn8-runtime
ENV CUDA_HOME=/usr/local/cuda
ENV TORCH_CUDA_ARCH_LIST="6.0 6.1 7.0 7.5 8.0 8.6+PTX"
RUN conda install -c "nvidia/label/cuda-12.1.1" cuda -y  # ← Creates package conflicts on Modal
ENV CUDA_HOME=$CONDA_PREFIX
RUN cd GroundingDINO/ && pip install -e .
```

---

## What We've Tried

**Attempt 1:** Follow their Dockerfile exactly
→ `LibMambaUnsatisfiableError: pytorch-cuda requires libcublas >=12.1.0.26,<12.1.3.1`

**Attempt 2:** Skip conda cuda install, use existing PyTorch CUDA
→ Network timeouts OR `_C` import error

**Attempt 3:** CPU PyTorch on GPU instance (current workaround)
→ Works but doesn't use GPU (24s vs target 5-10s)

---

## Questions

1. **How do we install PyTorch/TorchVision on Modal without `_C` import failures?**
2. **How can we resolve the conda CUDA package conflict while following GroundingDINO's requirements?**
3. **How do we ensure CUDA extensions compile when no GPU is available at build time?**
4. **Any Modal examples of deploying models with custom CUDA extensions?** (GroundingDINO, MMDetection, Detectron2)

---

## What We Need

A Modal-compatible way to satisfy GroundingDINO's setup requirements:
- Working PyTorch/TorchVision installation
- Properly compiled CUDA extensions
- GPU utilization at runtime

**Code:** `/Users/levit/Desktop/mvp/python_backend/modal_gpu_cuda.py`  
**GroundingDINO:** https://github.com/IDEA-Research/GroundingDINO

Thank you!

