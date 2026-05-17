from floodiq.baseline.national import percentile_national


def test_no_baseline_when_sample_too_small():
    result = percentile_national(50, additional_scores=[10, 20, 30])
    assert result.percentile is None
    assert result.sample_size == 3


def test_median_lands_near_50():
    scores = list(range(0, 100))
    result = percentile_national(50, additional_scores=scores)
    assert result.percentile is not None
    assert 49 <= result.percentile <= 51


def test_default_min_sample_is_20():
    scores = list(range(0, 19))  # one short of 20
    result = percentile_national(15, additional_scores=scores)
    assert result.percentile is None
