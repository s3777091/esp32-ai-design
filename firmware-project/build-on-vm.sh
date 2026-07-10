#!/usr/bin/env bash
# Build the DS-02 firmware (ESP32-S3 / ESP-BOX-3) inside an espressif/idf container.
#
# This repo is the xiaozhi *main component* only. The upstream xiaozhi-esp32
# project provides the wrapper (root CMakeLists, scripts/, partitions/). We
# clone it shallow, replace its main/ with this repo, then build in Docker.
#
# Usage (on the Linux build host):
#   ./build-on-vm.sh /path/to/this-repo [project-dir]
set -euo pipefail

SRC=${1:?path to the xiaozhi client component (this repo)}
PRJ=${2:-/root/fw/ds02-project}
IDF_IMAGE=${IDF_IMAGE:-espressif/idf:release-v5.5}
UPSTREAM=${UPSTREAM:-https://github.com/78/xiaozhi-esp32.git}

if [ ! -d "$PRJ/.git" ]; then
  rm -rf "$PRJ"
  git clone --depth 1 "$UPSTREAM" "$PRJ"
fi

rm -rf "$PRJ/main"
cp -a "$SRC" "$PRJ/main"
rm -rf "$PRJ/main/.git"

DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.esp32s3;main/firmware-project/sdkconfig.board.esp-box-3"

docker run --rm -v "$PRJ":"$PRJ" -w "$PRJ" "$IDF_IMAGE" \
  bash -c "idf.py -DSDKCONFIG_DEFAULTS=\"$DEFAULTS\" set-target esp32s3 build"

echo "== Build artifacts =="
ls -lh "$PRJ"/build/*.bin "$PRJ"/build/bootloader/bootloader.bin "$PRJ"/build/partition_table/partition-table.bin 2>/dev/null || true
