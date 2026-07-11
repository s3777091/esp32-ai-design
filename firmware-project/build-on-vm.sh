#!/usr/bin/env bash
# Build the DS-02 firmware (ESP32-S3 / ESP-BOX-3) inside an espressif/idf container.
#
# Self-contained: everything comes from THIS repo (esp32-ai-design).
# The repo is the xiaozhi client component; this script assembles the standard
# ESP-IDF project layout around it:
#
#   <project>/CMakeLists.txt          <- firmware-project/CMakeLists.txt
#   <project>/partitions_16m.csv      <- firmware-project/partitions_16m.csv
#   <project>/sdkconfig.defaults*     <- firmware-project/ + repo root
#   <project>/scripts/                <- repo scripts/ (gen_lang, build_default_assets)
#   <project>/main/                   <- the repo itself
#
# Usage (on the Linux build host):
#   ./build-on-vm.sh /path/to/esp32-ai-design [project-dir]
set -euo pipefail

SRC=${1:?path to the esp32-ai-design repo}
PRJ=${2:-/root/fw/ds02-project}
IDF_IMAGE=${IDF_IMAGE:-espressif/idf:release-v5.5}

mkdir -p "$PRJ"
cp "$SRC/firmware-project/CMakeLists.txt"        "$PRJ/CMakeLists.txt"
cp "$SRC/firmware-project/partitions_16m.csv"    "$PRJ/partitions_16m.csv"
cp "$SRC/firmware-project/sdkconfig.defaults"    "$PRJ/sdkconfig.defaults"
cp "$SRC/firmware-project/sdkconfig.board.esp-box-3" "$PRJ/sdkconfig.board.esp-box-3"
cp "$SRC/sdkconfig.defaults.esp32s3"             "$PRJ/sdkconfig.defaults.esp32s3"
rm -rf "$PRJ/scripts" "$PRJ/main"
cp -a "$SRC/scripts" "$PRJ/scripts"
cp -a "$SRC" "$PRJ/main"
rm -rf "$PRJ/main/.git"

DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.board.esp-box-3"

docker run --rm -v "$PRJ":"$PRJ" -w "$PRJ" "$IDF_IMAGE" \
  bash -c "idf.py -DSDKCONFIG_DEFAULTS=\"$DEFAULTS\" set-target esp32s3 build"

echo "== Build artifacts =="
ls -lh "$PRJ"/build/*.bin "$PRJ"/build/bootloader/bootloader.bin "$PRJ"/build/partition_table/partition-table.bin 2>/dev/null || true
